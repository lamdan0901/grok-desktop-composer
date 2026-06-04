import type { AnyMessage } from "@agentclientprotocol/sdk";

/**
 * Grok shell uses string JSON-RPC ids (e.g. `skills-reload`) on the same stdio
 * stream as ACP. The ACP SDK only tracks numeric request ids and logs an error
 * for unknown string responses.
 */
export function shouldDeliverAcpMessageToClient(message: AnyMessage): boolean {
  if (!message || typeof message !== "object") return false;

  const record = message as Record<string, unknown>;
  if ("method" in record) return true;

  if (!("id" in record)) return true;

  const id = record.id;
  if (typeof id === "string") return false;

  return true;
}

export function parseAcpLine(line: string): AnyMessage | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as AnyMessage;
  } catch {
    return null;
  }
}