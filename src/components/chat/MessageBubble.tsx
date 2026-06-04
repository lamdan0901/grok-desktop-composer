import { formatAssistantDisplayText } from "@/lib/streamChunkMerge";
import { CopyIconButton } from "./CopyIconButton";
import { MarkdownContent } from "./MarkdownContent";
import type { ChatMessage } from "@/lib/types";
import { ErrorBlock } from "./ErrorBlock";

interface MessageBubbleProps {
  message: ChatMessage;
}

function UserMessageBubble({
  content,
  attachments,
}: {
  content: string;
  attachments: NonNullable<Extract<ChatMessage, { role: "user" }>["attachments"]>;
}) {
  const hasText = content.trim().length > 0;

  return (
    <div className="message message--user">
      <div className="message__user-wrap">
        {hasText && (
          <CopyIconButton
            text={content}
            ariaLabel="Copy message"
          />
        )}
        <div className="message__bubble message__bubble--user">
          {attachments.length > 0 && (
            <div className="message__attachments" role="list">
              {attachments.map((attachment) => (
                <img
                  key={attachment.id}
                  role="listitem"
                  src={attachment.previewUrl}
                  alt=""
                  className="message__attachment-img"
                />
              ))}
            </div>
          )}
          {hasText ? <p className="message__text">{content}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "user") {
    return (
      <UserMessageBubble
        content={message.content}
        attachments={message.attachments ?? []}
      />
    );
  }

  if (message.role === "error") {
    return (
      <div className="message message--error">
        <ErrorBlock content={message.content} />
      </div>
    );
  }

  if (message.role === "system") {
    return (
      <div className="message message--system">
        <span className="message__system">{message.content}</span>
      </div>
    );
  }

  if (message.role === "thought" || message.role === "tool") {
    return null;
  }

  const displayContent = formatAssistantDisplayText(
    message.content || (message.streaming ? "…" : ""),
    message.streaming,
  );

  return (
    <div className="message message--assistant">
      <div className="message__bubble message__bubble--assistant">
        <div className="message__markdown">
          <MarkdownContent>{displayContent}</MarkdownContent>
        </div>
        {message.streaming && <span className="message__cursor" aria-hidden />}
      </div>
    </div>
  );
}