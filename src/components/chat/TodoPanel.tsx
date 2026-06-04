import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  ListTodo,
  Loader2,
  X,
} from "lucide-react";
import {
  countTodos,
  formatTodoBadge,
  type AgentTodo,
  type TodoStatus,
} from "@/lib/todos";

interface TodoPanelProps {
  todos: AgentTodo[];
}

function StatusIcon({ status }: { status: TodoStatus }) {
  const size = 14;
  switch (status) {
    case "in_progress":
      return (
        <Loader2
          size={size}
          className="todo-panel__icon todo-panel__icon--active"
          aria-hidden
        />
      );
    case "completed":
      return (
        <Check
          size={size}
          className="todo-panel__icon todo-panel__icon--done"
          aria-hidden
        />
      );
    case "cancelled":
      return (
        <X
          size={size}
          className="todo-panel__icon todo-panel__icon--cancelled"
          aria-hidden
        />
      );
    default:
      return (
        <Circle
          size={size}
          className="todo-panel__icon todo-panel__icon--pending"
          aria-hidden
        />
      );
  }
}

export function TodoPanel({ todos }: TodoPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const counts = countTodos(todos);
  const badge = formatTodoBadge(counts);

  if (todos.length === 0) return null;

  return (
    <section className="todo-panel" aria-label="Agent task list">
      <button
        type="button"
        className="todo-panel__toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <ListTodo size={14} className="todo-panel__header-icon" aria-hidden />
        <span className="todo-panel__title">Tasks</span>
        {badge && (
          <span className="todo-panel__badge" title="In progress · Pending · Done · Cancelled">
            {badge}
          </span>
        )}
      </button>
      {expanded && (
        <ul className="todo-panel__list">
          {todos.map((todo) => (
            <li
              key={todo.id}
              className={`todo-panel__item todo-panel__item--${todo.status}`}
            >
              <StatusIcon status={todo.status} />
              <span className="todo-panel__text">{todo.content}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}