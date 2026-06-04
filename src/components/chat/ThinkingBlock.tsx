import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { formatElapsed } from "@/lib/toolPresentation";

interface ThinkingBlockProps {
  content: string;
  streaming?: boolean;
  startedAt?: number;
  durationSeconds?: number;
  /** Rendered inside a turn activity section (no separate collapse). */
  embedded?: boolean;
}

export function ThinkingBlock({
  content,
  streaming,
  startedAt,
  durationSeconds,
  embedded,
}: ThinkingBlockProps) {
  const [elapsed, setElapsed] = useState(() => {
    if (durationSeconds != null) return durationSeconds;
    if (startedAt == null) return 0;
    return Math.max(0, (Date.now() - startedAt) / 1000);
  });

  useEffect(() => {
    if (!streaming) {
      if (durationSeconds != null) {
        setElapsed(durationSeconds);
      }
      return;
    }
    if (startedAt == null) return;

    const tick = () =>
      setElapsed(Math.max(0, (Date.now() - startedAt) / 1000));
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [startedAt, streaming, durationSeconds]);

  const label = streaming
    ? startedAt != null
      ? `Thinking… ${formatElapsed(elapsed)}`
      : "Thinking…"
    : durationSeconds != null
      ? `Thought for ${formatElapsed(durationSeconds)}`
      : "Thought";

  if (embedded) {
    return (
      <div
        className={`thinking-block thinking-block--embedded${streaming ? " thinking-block--live" : ""}`}
      >
        <div className="thinking-block__heading">
          <Sparkles size={13} className="thinking-block__icon" aria-hidden />
          <span>{label}</span>
        </div>
        {content.trim().length > 0 && (
          <div className="thinking-block__body">{content}</div>
        )}
      </div>
    );
  }

  return (
    <div className={`thinking-block${streaming ? " thinking-block--live" : ""}`}>
      <div className="thinking-block__heading">
        <Sparkles size={13} className="thinking-block__icon" aria-hidden />
        <span>{label}</span>
      </div>
      {content.trim().length > 0 && (
        <div className="thinking-block__body">{content}</div>
      )}
    </div>
  );
}