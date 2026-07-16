export type ProjectFileEntry = {
  path: string;
  isDir: boolean;
};

export type FileMentionContext = {
  range: { start: number; end: number };
  query: string;
  pathStart: number;
};

export function detectFileMention(
  text: string,
  cursor = text.length,
): FileMentionContext | null {
  if (cursor < 1 || cursor > text.length) return null;
  const at = text.slice(0, cursor).lastIndexOf("@");
  if (at < 0 || /[\p{L}\p{N}_]/u.test(text[at - 1] ?? "")) return null;

  const endOffset = text.slice(at + 1).search(/[\s,;]/);
  const end = endOffset < 0 ? text.length : at + 1 + endOffset;
  if (cursor > end) return null;

  return {
    range: { start: at, end },
    query: text.slice(at + 1, cursor),
    pathStart: at + 1,
  };
}

function subsequenceScore(path: string, query: string): number | null {
  if (!query) return 0;
  const lowerPath = path.toLowerCase();
  const lowerQuery = query.toLowerCase();
  if (lowerPath.includes(lowerQuery)) return 100 - lowerPath.indexOf(lowerQuery);

  let index = 0;
  for (const char of lowerQuery) {
    index = lowerPath.indexOf(char, index);
    if (index < 0) return null;
    index += 1;
  }
  return 50 - (lowerPath.length - lowerQuery.length);
}

export function filterFileMentions(
  entries: ProjectFileEntry[],
  query: string,
  limit = 8,
): ProjectFileEntry[] {
  const hidden = query.startsWith("!");
  const cleanQuery = hidden ? query.slice(1) : query;
  return entries
    .filter((entry) => hidden || !entry.path.split("/").some((part) => part.startsWith(".")))
    .map((entry) => ({ entry, score: subsequenceScore(entry.path, cleanQuery) }))
    .filter((item): item is { entry: ProjectFileEntry; score: number } => item.score !== null)
    .sort((a, b) => b.score - a.score || a.entry.path.localeCompare(b.entry.path))
    .slice(0, limit)
    .map((item) => item.entry);
}

export function replaceFileMention(
  text: string,
  context: FileMentionContext,
  path: string,
): string {
  return `${text.slice(0, context.pathStart)}${path}${text.slice(context.range.end)}`;
}
