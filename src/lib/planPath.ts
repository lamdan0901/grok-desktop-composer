/** URL-encode cwd the same way Grok stores session folders under ~/.grok/sessions/. */
export function encodeGrokSessionCwd(cwd: string): string {
  const normalized = cwd.replace(/\//g, "\\");
  return encodeURIComponent(normalized);
}