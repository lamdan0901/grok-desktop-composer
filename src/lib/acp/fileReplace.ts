/**
 * Fuzzy search/replace adapted from opencode packages/opencode/src/tool/edit.ts
 * (SimpleReplacer, LineTrimmedReplacer, BlockAnchorReplacer, etc.)
 */

export type Replacer = (content: string, find: string) => Generator<string, void, unknown>;

export type StrReplaceApplyResult =
  | { status: "applied"; content: string; replacements: number }
  | { status: "noop"; reason: "already_applied" }
  | { status: "error"; message: string };

const SINGLE_CANDIDATE_SIMILARITY_THRESHOLD = 0.0;
const MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD = 0.3;

export function normalizeLineEndings(text: string): string {
  return text.replaceAll("\r\n", "\n");
}

export function detectLineEnding(text: string): "\n" | "\r\n" {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

export function convertToLineEnding(text: string, ending: "\n" | "\r\n"): string {
  if (ending === "\n") return normalizeLineEndings(text);
  return normalizeLineEndings(text).replaceAll("\n", "\r\n");
}

function levenshtein(a: string, b: string): number {
  if (a === "" || b === "") return Math.max(a.length, b.length);
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

export const SimpleReplacer: Replacer = function* (_content, find) {
  yield find;
};

export const LineTrimmedReplacer: Replacer = function* (content, find) {
  const originalLines = content.split("\n");
  const searchLines = find.split("\n");
  if (searchLines[searchLines.length - 1] === "") searchLines.pop();

  for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
    let matches = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (originalLines[i + j].trim() !== searchLines[j].trim()) {
        matches = false;
        break;
      }
    }
    if (!matches) continue;

    let matchStartIndex = 0;
    for (let k = 0; k < i; k++) matchStartIndex += originalLines[k].length + 1;
    let matchEndIndex = matchStartIndex;
    for (let k = 0; k < searchLines.length; k++) {
      matchEndIndex += originalLines[i + k].length;
      if (k < searchLines.length - 1) matchEndIndex += 1;
    }
    yield content.substring(matchStartIndex, matchEndIndex);
  }
};

export const BlockAnchorReplacer: Replacer = function* (content, find) {
  const originalLines = content.split("\n");
  const searchLines = find.split("\n");
  if (searchLines.length < 3) return;
  if (searchLines[searchLines.length - 1] === "") searchLines.pop();

  const firstLineSearch = searchLines[0].trim();
  const lastLineSearch = searchLines[searchLines.length - 1].trim();
  const searchBlockSize = searchLines.length;

  const candidates: Array<{ startLine: number; endLine: number }> = [];
  for (let i = 0; i < originalLines.length; i++) {
    if (originalLines[i].trim() !== firstLineSearch) continue;
    for (let j = i + 2; j < originalLines.length; j++) {
      if (originalLines[j].trim() === lastLineSearch) {
        candidates.push({ startLine: i, endLine: j });
        break;
      }
    }
  }

  if (candidates.length === 0) return;

  function* yieldRange(startLine: number, endLine: number) {
    let matchStartIndex = 0;
    for (let k = 0; k < startLine; k++) matchStartIndex += originalLines[k].length + 1;
    let matchEndIndex = matchStartIndex;
    for (let k = startLine; k <= endLine; k++) {
      matchEndIndex += originalLines[k].length;
      if (k < endLine) matchEndIndex += 1;
    }
    yield content.substring(matchStartIndex, matchEndIndex);
  }

  if (candidates.length === 1) {
    const { startLine, endLine } = candidates[0];
    const actualBlockSize = endLine - startLine + 1;
    let similarity = 0;
    const linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2);
    if (linesToCheck > 0) {
      for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
        const originalLine = originalLines[startLine + j].trim();
        const searchLine = searchLines[j].trim();
        const maxLen = Math.max(originalLine.length, searchLine.length);
        if (maxLen === 0) continue;
        similarity += (1 - levenshtein(originalLine, searchLine) / maxLen) / linesToCheck;
        if (similarity >= SINGLE_CANDIDATE_SIMILARITY_THRESHOLD) break;
      }
    } else {
      similarity = 1.0;
    }
    if (similarity >= SINGLE_CANDIDATE_SIMILARITY_THRESHOLD) {
      yield* yieldRange(startLine, endLine);
    }
    return;
  }

  let bestMatch: { startLine: number; endLine: number } | null = null;
  let maxSimilarity = -1;
  for (const candidate of candidates) {
    const { startLine, endLine } = candidate;
    const actualBlockSize = endLine - startLine + 1;
    let similarity = 0;
    const linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2);
    if (linesToCheck > 0) {
      for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
        const originalLine = originalLines[startLine + j].trim();
        const searchLine = searchLines[j].trim();
        const maxLen = Math.max(originalLine.length, searchLine.length);
        if (maxLen === 0) continue;
        similarity += 1 - levenshtein(originalLine, searchLine) / maxLen;
      }
      similarity /= linesToCheck;
    } else {
      similarity = 1.0;
    }
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      bestMatch = candidate;
    }
  }

  if (maxSimilarity >= MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD && bestMatch) {
    yield* yieldRange(bestMatch.startLine, bestMatch.endLine);
  }
};

export const WhitespaceNormalizedReplacer: Replacer = function* (content, find) {
  const normalizeWhitespace = (text: string) => text.replace(/\s+/g, " ").trim();
  const normalizedFind = normalizeWhitespace(find);
  const lines = content.split("\n");

  for (const line of lines) {
    if (normalizeWhitespace(line) === normalizedFind) yield line;
  }

  const findLines = find.split("\n");
  if (findLines.length > 1) {
    for (let i = 0; i <= lines.length - findLines.length; i++) {
      const block = lines.slice(i, i + findLines.length);
      if (normalizeWhitespace(block.join("\n")) === normalizedFind) yield block.join("\n");
    }
  }
};

export const IndentationFlexibleReplacer: Replacer = function* (content, find) {
  const removeIndentation = (text: string) => {
    const lines = text.split("\n");
    const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
    if (nonEmptyLines.length === 0) return text;
    const minIndent = Math.min(
      ...nonEmptyLines.map((line) => line.match(/^(\s*)/)?.[1]?.length ?? 0),
    );
    return lines
      .map((line) => (line.trim().length === 0 ? line : line.slice(minIndent)))
      .join("\n");
  };

  const normalizedFind = removeIndentation(find);
  const contentLines = content.split("\n");
  const findLines = find.split("\n");

  for (let i = 0; i <= contentLines.length - findLines.length; i++) {
    const block = contentLines.slice(i, i + findLines.length).join("\n");
    if (removeIndentation(block) === normalizedFind) yield block;
  }
};

export const TrimmedBoundaryReplacer: Replacer = function* (content, find) {
  const trimmedFind = find.trim();
  if (trimmedFind === find) return;
  if (content.includes(trimmedFind)) yield trimmedFind;

  const lines = content.split("\n");
  const findLines = find.split("\n");
  for (let i = 0; i <= lines.length - findLines.length; i++) {
    const block = lines.slice(i, i + findLines.length).join("\n");
    if (block.trim() === trimmedFind) yield block;
  }
};

export const MultiOccurrenceReplacer: Replacer = function* (content, find) {
  let startIndex = 0;
  while (true) {
    const index = content.indexOf(find, startIndex);
    if (index === -1) break;
    yield find;
    startIndex = index + find.length;
  }
};

const REPLACERS: Replacer[] = [
  SimpleReplacer,
  LineTrimmedReplacer,
  BlockAnchorReplacer,
  WhitespaceNormalizedReplacer,
  IndentationFlexibleReplacer,
  TrimmedBoundaryReplacer,
  MultiOccurrenceReplacer,
];

export function countExactOccurrences(content: string, search: string): number {
  if (search === "") return 0;
  let count = 0;
  let offset = 0;
  while ((offset = content.indexOf(search, offset)) !== -1) {
    count++;
    offset += search.length;
  }
  return count;
}

/**
 * Replace oldString with newString using opencode-style fuzzy matching.
 * @throws when oldString cannot be matched uniquely (unless replaceAll).
 */
export function replaceInContent(
  content: string,
  oldString: string,
  newString: string,
  replaceAll = false,
): string {
  if (oldString === newString) {
    throw new Error("No changes to apply: oldString and newString are identical.");
  }

  let notFound = true;

  for (const replacer of REPLACERS) {
    for (const search of replacer(content, oldString)) {
      const index = content.indexOf(search);
      if (index === -1) continue;
      notFound = false;
      if (replaceAll) return content.replaceAll(search, newString);
      const lastIndex = content.lastIndexOf(search);
      if (index !== lastIndex) {
        throw new Error(
          "Found multiple matches for oldString. Provide more surrounding context or set replaceAll to true.",
        );
      }
      return content.substring(0, index) + newString + content.substring(index + search.length);
    }
  }

  if (notFound) {
    throw new Error(
      "Could not find oldString in the file. It must match exactly, including whitespace, indentation, and line endings.",
    );
  }

  throw new Error(
    "Found multiple matches for oldString. Provide more surrounding context to make the match unique.",
  );
}

export function looksAlreadyApplied(
  content: string,
  oldString: string,
  newString: string,
): boolean {
  if (oldString.length === 0) return false;
  const ending = detectLineEnding(content);
  const oldNorm = convertToLineEnding(oldString, ending);
  const newNorm = convertToLineEnding(newString, ending);
  if (content.includes(oldNorm)) return false;
  if (oldNorm === newNorm) return true;
  if (!content.includes(newNorm)) return false;
  try {
    replaceInContent(content, oldNorm, newNorm, false);
    return false;
  } catch {
    return true;
  }
}

export function applyStrReplaceToContent(
  fileContent: string,
  oldString: string,
  newString: string,
  options?: { replaceAll?: boolean },
): StrReplaceApplyResult {
  if (oldString === newString) {
    return { status: "error", message: "No changes to apply: oldString and newString are identical." };
  }
  if (oldString.length === 0) {
    return {
      status: "error",
      message: "oldString must not be empty. Use Write to create or overwrite a file.",
    };
  }

  const ending = detectLineEnding(fileContent);
  const oldNorm = convertToLineEnding(oldString, ending);
  const newNorm = convertToLineEnding(newString, ending);

  if (looksAlreadyApplied(fileContent, oldNorm, newNorm)) {
    return { status: "noop", reason: "already_applied" };
  }

  const exactCount = countExactOccurrences(fileContent, oldNorm);
  if (exactCount > 1 && !options?.replaceAll) {
    return {
      status: "error",
      message:
        "Found multiple exact matches for oldString. Provide more surrounding context or set replaceAll to true.",
    };
  }

  try {
    const next = replaceInContent(fileContent, oldNorm, newNorm, options?.replaceAll === true);
    const replacements =
      options?.replaceAll === true
        ? countExactOccurrences(fileContent, oldNorm)
        : 1;
    return { status: "applied", content: next, replacements };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (looksAlreadyApplied(fileContent, oldNorm, newNorm)) {
      return { status: "noop", reason: "already_applied" };
    }
    return { status: "error", message };
  }
}