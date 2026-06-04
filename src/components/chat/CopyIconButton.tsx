import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyIconButtonProps {
  text: string;
  className?: string;
  ariaLabel?: string;
  title?: string;
}

export function CopyIconButton({
  text,
  className = "message__copy",
  ariaLabel = "Copy",
  title = "Copy",
}: CopyIconButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [text]);

  return (
    <button
      type="button"
      className={className}
      onClick={() => void handleCopy()}
      aria-label={copied ? "Copied" : ariaLabel}
      title={copied ? "Copied" : title}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}