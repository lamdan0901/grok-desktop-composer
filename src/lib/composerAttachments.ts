import type { ContentBlock } from "@agentclientprotocol/sdk";
import type { UserMessageAttachment } from "@/lib/types";

export const MAX_COMPOSER_ATTACHMENTS = 10;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type ComposerAttachment = {
  id: string;
  name: string;
  mimeType: string;
  /** Base64 payload without a data: prefix. */
  data: string;
  /** Full data URL for UI preview. */
  previewUrl: string;
};

function newAttachmentId(): string {
  return crypto.randomUUID();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Failed to read file"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1]!, data: match[2]! };
}

export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export async function fileToComposerAttachment(
  file: File,
): Promise<ComposerAttachment | null> {
  if (!isImageMimeType(file.type)) return null;
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(
      `"${file.name}" is too large (max ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB)`,
    );
  }

  const previewUrl = await readFileAsDataUrl(file);
  const parsed = parseDataUrl(previewUrl);
  if (!parsed) return null;

  return {
    id: newAttachmentId(),
    name: file.name,
    mimeType: parsed.mimeType,
    data: parsed.data,
    previewUrl,
  };
}

export async function filesToComposerAttachments(
  files: Iterable<File>,
  existingCount: number,
): Promise<ComposerAttachment[]> {
  const slots = MAX_COMPOSER_ATTACHMENTS - existingCount;
  if (slots <= 0) return [];

  const out: ComposerAttachment[] = [];
  for (const file of files) {
    if (out.length >= slots) break;
    const attachment = await fileToComposerAttachment(file);
    if (attachment) out.push(attachment);
  }
  return out;
}

export function attachmentsFromClipboard(
  data: DataTransfer | null,
): File[] {
  if (!data) return [];
  const files: File[] = [];
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    if (item?.kind !== "file") continue;
    const file = item.getAsFile();
    if (file && isImageMimeType(file.type)) files.push(file);
  }
  if (files.length > 0) return files;

  for (let i = 0; i < data.files.length; i++) {
    const file = data.files[i];
    if (file && isImageMimeType(file.type)) files.push(file);
  }
  return files;
}

export function toUserMessageAttachments(
  attachments: ComposerAttachment[],
): UserMessageAttachment[] {
  return attachments.map(({ id, mimeType, previewUrl }) => ({
    id,
    mimeType,
    previewUrl,
  }));
}

export function toPromptContentBlocks(
  text: string,
  attachments: ComposerAttachment[],
): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const trimmed = text.trim();
  if (trimmed) {
    blocks.push({ type: "text", text: trimmed });
  }
  for (const attachment of attachments) {
    blocks.push({
      type: "image",
      mimeType: attachment.mimeType,
      data: attachment.data,
    });
  }
  return blocks;
}

export function promptTitleSource(
  text: string,
  attachmentCount: number,
): string {
  const trimmed = text.trim();
  if (trimmed) return trimmed;
  if (attachmentCount === 1) return "Image";
  if (attachmentCount > 1) return `${attachmentCount} images`;
  return "";
}

export function canSendComposer(
  text: string,
  attachmentCount: number,
): boolean {
  return Boolean(text.trim()) || attachmentCount > 0;
}