import { create } from "zustand";
import {
  hasActiveTodos,
  mergeTodoLists,
  type AgentTodo,
} from "@/lib/todos";
import type { SessionId } from "@/lib/types";

/** Stable empty list for selectors (must not allocate `[]` per read). */
export const EMPTY_TODOS: AgentTodo[] = [];

function todosEqual(a: AgentTodo[], b: AgentTodo[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i]!;
    const right = b[i]!;
    if (
      left.id !== right.id ||
      left.content !== right.content ||
      left.status !== right.status
    ) {
      return false;
    }
  }
  return true;
}

interface TodoState {
  bySession: Record<SessionId, AgentTodo[]>;
  setTodos: (
    sessionId: SessionId,
    todos: AgentTodo[],
    merge: boolean,
  ) => void;
  clearTodos: (sessionId: SessionId) => void;
}

export const useTodoStore = create<TodoState>((set) => ({
  bySession: {},

  setTodos(sessionId, todos, merge) {
    set((state) => {
      const current = state.bySession[sessionId] ?? EMPTY_TODOS;
      const next = merge ? mergeTodoLists(current, todos, true) : todos;
      if (todosEqual(current, next)) return state;
      if (next.length === 0) {
        if (!(sessionId in state.bySession)) return state;
        const { [sessionId]: _, ...rest } = state.bySession;
        return { bySession: rest };
      }
      return {
        bySession: { ...state.bySession, [sessionId]: next },
      };
    });
  },

  clearTodos(sessionId) {
    set((state) => {
      if (!(sessionId in state.bySession)) return state;
      const { [sessionId]: _, ...rest } = state.bySession;
      return { bySession: rest };
    });
  },
}));

export function selectSessionTodos(
  bySession: Record<SessionId, AgentTodo[]>,
  sessionId: SessionId | null | undefined,
): AgentTodo[] {
  if (!sessionId) return EMPTY_TODOS;
  return bySession[sessionId] ?? EMPTY_TODOS;
}

export { hasActiveTodos };