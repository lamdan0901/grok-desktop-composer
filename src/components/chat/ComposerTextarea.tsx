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
  onChange: (value: string) => void;
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
  onKeyDown,
  onPaste,
  focusKey,
}: ComposerTextareaProps) {
  const { ref, adjust } = useAutoResizeTextarea(value, maxHeight);

  useEffect(() => {
    if (!focusKey) return;
    const frame = requestAnimationFrame(() => {
      ref.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusKey, ref]);

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
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onInput={adjust}
      />
    </div>
  );
}