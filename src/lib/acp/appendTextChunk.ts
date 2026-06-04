/**
 * ACP `agent_message_chunk` / `agent_thought_chunk` text merge.
 *
 * Per the Agent Client Protocol, streamed chunks are concatenated by the client.
 * Reference implementations append the chunk verbatim:
 * - Zed `acp_thread`: `block.append(chunk)` on text content blocks
 * - OpenCode `acp/event.ts`: forwards `props.delta` as each chunk's `text`
 *
 * Agents may send either incremental deltas or cumulative snapshots (full text
 * so far). This helper handles both without token-guessing heuristics.
 */

export function normalizeStreamText(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

/**
 * Merge one streamed text chunk into the accumulated buffer for the active message.
 */
export function appendAcpTextChunk(existing: string, chunk: string): string {
  const prior = normalizeStreamText(existing);
  const next = normalizeStreamText(chunk);

  if (!next) return prior;
  if (!prior) return next;
  if (next === prior) return prior;

  // Cumulative snapshot (OpenCode/Zed assume well-formed deltas; Grok may resend full prefix).
  if (next.startsWith(prior)) return next;
  if (prior.startsWith(next)) return prior;

  // Duplicate tail delivery (e.g. standard + extension notification).
  if (prior.endsWith(next)) return prior;

  if (isDoubledCumulative(prior, next)) return prior;

  return prior + next;
}

/** Agent resent the entire buffer as the next chunk. */
function isDoubledCumulative(existing: string, chunk: string): boolean {
  if (!chunk.startsWith(existing) || chunk.length <= existing.length) {
    return false;
  }

  const suffix = chunk.slice(existing.length);
  if (suffix === existing) return true;
  if (suffix === ` ${existing}` || suffix === `\n${existing}`) return true;

  if (suffix.startsWith(existing)) {
    const after = suffix.slice(existing.length);
    if (after === "" || after === " " || after === "\n") return true;
  }
  if (suffix.startsWith(` ${existing}`)) {
    const after = suffix.slice(` ${existing}`.length);
    if (after === "" || after === " " || after === "\n") return true;
  }

  return false;
}