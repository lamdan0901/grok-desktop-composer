import type { ContentBlock } from "@agentclientprotocol/sdk";
import { readProjectImage } from "@/lib/acpFs";
import {
  toPromptContentBlocks,
  type PromptImage,
} from "@/lib/composerAttachments";

const IMAGE_EXTENSION = /\.(?:png|jpe?g|gif|webp|bmp|svg)$/i;
const QUOTED_IMAGE_PATH = /(["'])@?([^"'\r\n]+?\.(?:png|jpe?g|gif|webp|bmp|svg))\1/gi;
const BARE_IMAGE_PATH = /(?:^|[\s(\[])@?([^\s"'<>()\[\]{},;]+?\.(?:png|jpe?g|gif|webp|bmp|svg))(?=$|[\s)\]},;!?])/gi;

function stripMentionAndQuotes(path: string): string {
  const value = path.trim().replace(/^@/, "");
  const quote = value[0];
  return (quote === "\"" || quote === "'") && value.at(-1) === quote
    ? value.slice(1, -1)
    : value;
}

export function isRepositoryImagePath(path: string): boolean {
  return IMAGE_EXTENSION.test(stripMentionAndQuotes(path));
}

export function extractRepositoryImagePaths(text: string): string[] {
  const matches: Array<{ index: number; path: string }> = [];
  for (const match of text.matchAll(QUOTED_IMAGE_PATH)) {
    matches.push({ index: match.index, path: match[2]! });
  }
  for (const match of text.matchAll(BARE_IMAGE_PATH)) {
    matches.push({ index: match.index, path: match[1]! });
  }
  matches.sort((left, right) => left.index - right.index);

  const seen = new Set<string>();
  return matches.flatMap(({ path }) => {
    const normalized = stripMentionAndQuotes(path);
    if (seen.has(normalized)) return [];
    seen.add(normalized);
    return [normalized];
  });
}

export async function buildPromptContentBlocks(
  text: string,
  attachments: readonly PromptImage[],
  root: string,
): Promise<ContentBlock[]> {
  const repositoryImages = await Promise.all(
    extractRepositoryImagePaths(text).map((path) => readProjectImage(root, path)),
  );
  return toPromptContentBlocks(text, [...attachments, ...repositoryImages]);
}
