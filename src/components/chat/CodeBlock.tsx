import { useCallback, useState, type ReactElement, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

/** Flatten highlighted code (nested spans) into plain text for clipboard. */
function reactNodeToText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(reactNodeToText).join("");
  if (typeof node === "object" && "props" in node) {
    const el = node as ReactElement<{ children?: ReactNode }>;
    return reactNodeToText(el.props.children);
  }
  return "";
}

function extractCode(children: ReactNode): { lang: string; text: string } {
  if (!children || typeof children !== "object" || !("props" in children)) {
    return { lang: "", text: "" };
  }
  const el = children as ReactElement<{
    className?: string;
    children?: ReactNode;
  }>;
  const className = el.props.className ?? "";
  const lang = /language-([\w+#.-]+)/i.exec(className)?.[1] ?? "";
  const text = reactNodeToText(el.props.children).replace(/\n$/, "");
  return { lang, text };
}

interface CodeBlockProps {
  children: ReactNode;
}

export function CodeBlock({ children }: CodeBlockProps) {
  const { lang, text } = extractCode(children);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [text]);

  return (
    <div className="code-block">
      <div className="code-block__header">
        <span className="code-block__lang">{lang || "text"}</span>
        <button
          type="button"
          className="code-block__copy"
          onClick={() => void handleCopy()}
          aria-label={copied ? "Copied" : "Copy code"}
          title={copied ? "Copied" : "Copy"}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <pre className="code-block__pre">{children}</pre>
    </div>
  );
}