/** stderr / ACP attach noise that should not become in-chat error bubbles. */
export function isBenignAcpNoise(message: string): boolean {
  const t = message.trim();
  if (!t) return true;
  if (/method not found/i.test(t)) return true;
  if (/["']Method not found["']/i.test(t)) return true;
  if (/-32601/.test(t) && /method/i.test(t)) return true;
  return false;
}

export function isBenignAttachError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  if (isBenignAcpNoise(message)) return true;
  if (/does not support (loading|resuming)/i.test(message)) return true;
  // Treat invalid params on attach (resume/load) as recoverable for old threads:
  // the cwd/session may not support the resume method (or agent is strict), but the
  // subsequent prompt({sessionId}) may still succeed for continuing the persisted thread.
  if (/invalid params/i.test(message) || /-32602/.test(message)) return true;
  return false;
}