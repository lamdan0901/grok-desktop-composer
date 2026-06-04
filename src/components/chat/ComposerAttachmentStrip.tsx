import { X } from "lucide-react";
import type { ComposerAttachment } from "@/lib/composerAttachments";

type ComposerAttachmentStripProps = {
  attachments: ComposerAttachment[];
  onRemove: (id: string) => void;
  className?: string;
};

export function ComposerAttachmentStrip({
  attachments,
  onRemove,
  className,
}: ComposerAttachmentStripProps) {
  if (!attachments.length) return null;

  return (
    <div
      className={className ?? "composer-attachments"}
      role="list"
      aria-label="Attached images"
    >
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="composer-attachments__item"
          role="listitem"
        >
          <img
            src={attachment.previewUrl}
            alt={attachment.name}
            className="composer-attachments__thumb"
          />
          <button
            type="button"
            className="composer-attachments__remove"
            aria-label={`Remove ${attachment.name}`}
            onClick={() => onRemove(attachment.id)}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function ComposerFileInput({
  inputRef,
  onChange,
  disabled,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      hidden
      disabled={disabled}
      onChange={onChange}
    />
  );
}