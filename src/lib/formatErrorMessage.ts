/** Strip terminal ANSI SGR sequences (with or without ESC prefix). */
export function stripAnsi(text: string): string {
  return text
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\[(?:\d{1,3}(?:;\d{1,3})*)*m/g, "");
}

const LOG_FIELD_KEYS = [
  "session_id",
  "tool_name",
  "effective_tool_name",
  "model_id",
  "error_kind",
  "error_message",
] as const;

export type AgentErrorFieldKey = (typeof LOG_FIELD_KEYS)[number];

export interface ParsedAgentError {
  timestamp?: string;
  level?: string;
  category?: string;
  summary?: string;
  fields: Partial<Record<AgentErrorFieldKey, string>>;
  raw: string;
}

export interface FormattedErrorDisplay {
  title: string;
  message: string;
  details: Array<{ label: string; value: string }>;
  raw: string;
  /** Single-line tool error: icon + title only. */
  compact?: boolean;
}

function parseKeyValueFields(text: string): Partial<Record<AgentErrorFieldKey, string>> {
  const fields: Partial<Record<AgentErrorFieldKey, string>> = {};
  if (!text.trim()) return fields;

  const keyPattern = new RegExp(`\\b(${LOG_FIELD_KEYS.join("|")})=`, "g");
  const positions: Array<{ key: AgentErrorFieldKey; valueStart: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = keyPattern.exec(text)) !== null) {
    positions.push({
      key: match[1] as AgentErrorFieldKey,
      valueStart: match.index + match[0].length,
    });
  }

  for (let i = 0; i < positions.length; i += 1) {
    const { key, valueStart } = positions[i];
    const valueEnd =
      i + 1 < positions.length ? positions[i + 1].valueStart : text.length;
    let value = text.slice(valueStart, valueEnd).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    fields[key] = value;
  }

  return fields;
}

function parseStructuredLogLine(line: string): ParsedAgentError | null {
  const cleaned = stripAnsi(line).trim();
  const header = cleaned.match(
    /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+(ERROR|WARN|INFO)\s+(.+)$/i,
  );
  if (!header) return null;

  const [, timestamp, level, rest] = header;
  let category: string | undefined;
  let tail = rest;

  const colonIdx = rest.indexOf(": ");
  if (colonIdx > 0 && colonIdx < 40 && !rest.slice(0, colonIdx).includes("=")) {
    category = rest.slice(0, colonIdx);
    tail = rest.slice(colonIdx + 2);
  }

  const firstSpace = tail.search(/\s+\w+=/);
  let summary: string;
  let kvPart: string;
  if (firstSpace === -1) {
    summary = tail.trim();
    kvPart = "";
  } else {
    summary = tail.slice(0, firstSpace).trim();
    kvPart = tail.slice(firstSpace).trim();
  }

  return {
    timestamp,
    level: level.toUpperCase(),
    category,
    summary,
    fields: parseKeyValueFields(kvPart),
    raw: cleaned,
  };
}

function humanizeToken(token: string): string {
  return token.replace(/_/g, " ");
}

function toolErrorName(parsed: ParsedAgentError): string {
  const name =
    parsed.fields.error_kind?.trim() ||
    parsed.summary?.trim() ||
    parsed.fields.tool_name?.trim() ||
    parsed.fields.effective_tool_name?.trim();
  return name ? humanizeToken(name) : "unknown";
}

function buildTitle(parsed: ParsedAgentError): string {
  if (parsed.category === "tool_error") return `Tool error: ${toolErrorName(parsed)}`;
  if (parsed.level === "ERROR") return "Error";
  if (parsed.level === "WARN") return "Warning";
  return "Notice";
}

function buildMessage(parsed: ParsedAgentError): string {
  const { fields, summary } = parsed;
  if (fields.error_message?.trim()) return fields.error_message.trim();

  const kind = fields.error_kind ?? summary;
  const tool = fields.tool_name ?? fields.effective_tool_name;
  if (tool && kind) {
    return `${tool} failed (${humanizeToken(kind)})`;
  }
  if (tool) return `${tool} failed`;
  if (kind) return humanizeToken(kind);
  if (summary) return humanizeToken(summary);
  return parsed.raw;
}

const DETAIL_LABELS: Record<AgentErrorFieldKey, string> = {
  tool_name: "Tool",
  effective_tool_name: "Tool",
  error_kind: "Kind",
  error_message: "Details",
  model_id: "Model",
  session_id: "Session",
};

function truncateId(id: string, max = 12): string {
  if (id.length <= max + 4) return id;
  return `${id.slice(0, max)}…`;
}

function buildDetails(
  parsed: ParsedAgentError,
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  const seen = new Set<string>();

  const add = (key: AgentErrorFieldKey, value: string) => {
    if (!value.trim() || seen.has(key)) return;
    seen.add(key);
    const label = DETAIL_LABELS[key];
    rows.push({
      label,
      value: key === "session_id" ? truncateId(value) : value,
    });
  };

  add("tool_name", parsed.fields.tool_name ?? "");
  add("error_kind", parsed.fields.error_kind ?? parsed.summary ?? "");
  if (parsed.fields.error_message && !buildMessage(parsed).includes(parsed.fields.error_message)) {
    add("error_message", parsed.fields.error_message);
  }
  add("model_id", parsed.fields.model_id ?? "");
  add("session_id", parsed.fields.session_id ?? "");

  return rows;
}

export function parseAgentErrorLog(raw: string): ParsedAgentError | null {
  const lines = stripAnsi(raw)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const parsed = parseStructuredLogLine(line);
    if (parsed) return parsed;
  }
  return null;
}

export function formatErrorForDisplay(raw: string): FormattedErrorDisplay {
  const cleaned = stripAnsi(raw).trim();
  const parsed = parseAgentErrorLog(raw);

  if (!parsed) {
    return {
      title: "Error",
      message: cleaned || raw,
      details: [],
      raw: cleaned || raw,
    };
  }

  const isToolError = parsed.category === "tool_error";

  return {
    title: buildTitle(parsed),
    message: isToolError ? "" : buildMessage(parsed),
    details: isToolError ? [] : buildDetails(parsed),
    raw: cleaned,
    compact: isToolError,
  };
}