export function titleFromPrompt(text: string, maxLen = 40): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (!oneLine) return "New chat";
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, maxLen - 1)}…`;
}