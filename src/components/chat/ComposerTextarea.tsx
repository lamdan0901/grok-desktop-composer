import { useEffect, type KeyboardEvent, type Ref } from "react";
import { useAutoResizeTextarea } from "@/hooks/useAutoResizeTextarea";

type ComposerTextareaProps = {
  anchorRef?: Ref<HTMLDivElement>;
  className: string;
  wrapClassName?: string;
  placeholder: string;
  value: string;
  disabled?: boolean;
  maxHeight?: number;
  /** When this value changes, focus the textarea (e.g. active thread id). */
  focusKey?: string | null;
  cursor?: number;
  onChange: (value: string) => void;
  onCursorChange?: (cursor: number) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
};

export function ComposerTextarea({
  anchorRef,
  className,
  wrapClassName,
  placeholder,
  value,
  disabled,
  maxHeight,
  onChange,
  onCursorChange,
  onKeyDown,
  onPaste,
  focusKey,
  cursor,
}: ComposerTextareaProps) {
  const { ref, adjust } = useAutoResizeTextarea(value, maxHeight);

  useEffect(() => {
    if (!focusKey) return;
    const frame = requestAnimationFrame(() => {
      ref.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusKey, ref]);

  useEffect(() => {
    if (cursor == null) return;
    const textarea = ref.current;
    if (!textarea || textarea.selectionEnd !== textarea.selectionStart) return;
    textarea.setSelectionRange(cursor, cursor);
  }, [cursor, ref, value]);

  return (
    <div
      ref={anchorRef}
      className={wrapClassName ?? "composer-textarea-wrap"}
    >
      <textarea
        ref={ref}
        className={className}
        rows={1}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          onCursorChange?.(e.currentTarget.selectionStart);
        }}
        onSelect={(e) => onCursorChange?.(e.currentTarget.selectionStart)}
        onKeyUp={(e) => onCursorChange?.(e.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onInput={adjust}
      />
    </div>
  );
}
