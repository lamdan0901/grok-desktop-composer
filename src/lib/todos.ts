export type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface AgentTodo {
  id: string;
  content: string;
  status: TodoStatus;
}

export interface TodoCounts {
  in_progress: number;
  pending: number;
  completed: number;
  cancelled: number;
}

const TODO_STATUSES = new Set<TodoStatus>([
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);

function normalizeStatus(raw: unknown): TodoStatus {
  if (typeof raw === "string" && TODO_STATUSES.has(raw as TodoStatus)) {
    return raw as TodoStatus;
  }
  return "pending";
}

function normalizeTodo(raw: unknown, index: number): AgentTodo | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const content =
    typeof row.content === "string" ? row.content.trim() : "";
  if (!content) return null;
  const id =
    typeof row.id === "string" && row.id.trim()
      ? row.id.trim()
      : String(index + 1);
  return {
    id,
    content,
    status: normalizeStatus(row.status),
  };
}

function todosFromArray(raw: unknown): AgentTodo[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const todos: AgentTodo[] = [];
  raw.forEach((item, i) => {
    const t = normalizeTodo(item, i);
    if (t) todos.push(t);
  });
  return todos.length > 0 ? todos : null;
}

function todosFromStateMap(raw: unknown): AgentTodo[] | null {
  if (!raw || typeof raw !== "object") return null;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length === 0) return null;
  const todos: AgentTodo[] = [];
  for (const [id, value] of entries) {
    const t = normalizeTodo({ id, ...(value as object) }, todos.length);
    if (t) todos.push(t);
  }
  return todos.length > 0 ? todos : null;
}

export function parseTodosFromToolPayload(
  raw: Record<string, unknown>,
): { todos: AgentTodo[]; merge: boolean } | null {
  const rawInput =
    raw.rawInput && typeof raw.rawInput === "object"
      ? (raw.rawInput as Record<string, unknown>)
      : null;

  let todos: AgentTodo[] | null = null;
  let merge = false;

  if (rawInput) {
    merge = Boolean(rawInput.merge);
    todos = todosFromArray(rawInput.todos);
  }

  const rawOutput =
    raw.rawOutput && typeof raw.rawOutput === "object"
      ? (raw.rawOutput as Record<string, unknown>)
      : null;
  const updated = rawOutput?.TodosUpdated;
  if (updated && typeof updated === "object") {
    const block = updated as Record<string, unknown>;
    const fromList = todosFromArray(block.todos);
    if (fromList) todos = fromList;
    const state = block.state;
    if (state && typeof state === "object") {
      const fromState = todosFromStateMap(
        (state as Record<string, unknown>).todos,
      );
      if (fromState) todos = fromState;
    }
  }

  if (!todos) return null;
  return { todos, merge };
}

export function isTodoToolTitle(title?: string | null): boolean {
  const trimmed = (title ?? "").trim();
  const lower = trimmed.toLowerCase();
  if (lower === "todowrite" || lower === "todo_write") return true;
  if (/^updating plan$/i.test(trimmed)) return true;
  return false;
}

export function isTodoWriteTool(
  title?: string | null,
  raw?: Record<string, unknown>,
): boolean {
  if (isTodoToolTitle(title)) return true;
  if (!raw) return false;
  const rawInput =
    raw.rawInput && typeof raw.rawInput === "object"
      ? (raw.rawInput as Record<string, unknown>)
      : null;
  if (rawInput?.variant === "CursorTodoWrite") return true;
  if (Array.isArray(rawInput?.todos)) return true;
  return parseTodosFromToolPayload(raw) != null;
}

export function mergeTodoLists(
  current: AgentTodo[],
  incoming: AgentTodo[],
  merge: boolean,
): AgentTodo[] {
  if (!merge) return incoming;
  const byId = new Map(current.map((t) => [t.id, t]));
  for (const t of incoming) {
    byId.set(t.id, t);
  }
  return [...byId.values()];
}

export function countTodos(todos: AgentTodo[]): TodoCounts {
  const counts: TodoCounts = {
    in_progress: 0,
    pending: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const t of todos) {
    counts[t.status] += 1;
  }
  return counts;
}

/** grok-cli default badge: in_progress, pending, completed, cancelled */
export function formatTodoBadge(counts: TodoCounts): string | null {
  const parts = [
    counts.in_progress,
    counts.pending,
    counts.completed,
    counts.cancelled,
  ];
  if (parts.every((n) => n === 0)) return null;
  return `[${parts.join(" ")}]`;
}

export function hasActiveTodos(todos: AgentTodo[]): boolean {
  return todos.some(
    (t) => t.status === "pending" || t.status === "in_progress",
  );
}