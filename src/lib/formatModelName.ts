/** Slug-style id, e.g. grok-comp-2.5-fast */
function isSlugLike(id: string): boolean {
  return /[-_]/.test(id) && !/\s/.test(id);
}

function formatSegment(part: string): string {
  if (/^\d+(\.\d+)*[a-z]*$/i.test(part) || /^v\d/i.test(part)) {
    return part;
  }
  if (!part) return part;
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

/** grok-comp-2.5-fast → Grok Comp 2.5 Fast */
export function formatModelName(modelId: string): string {
  const trimmed = modelId.trim();
  if (!trimmed) return modelId;
  if (!isSlugLike(trimmed)) {
    return trimmed;
  }
  return trimmed.split(/[-_]+/).map(formatSegment).join(" ");
}

/** Prefer ACP display name when it is already human-readable. */
export function modelChoiceLabel(name: string | undefined, value: string): string {
  const n = name?.trim();
  if (n && n !== value && !isSlugLike(n)) return n;
  return formatModelName(value);
}