import { CopyIconButton } from "./CopyIconButton";

interface TurnResponseCopyProps {
  text: string;
}

export function TurnResponseCopy({ text }: TurnResponseCopyProps) {
  if (!text.trim()) return null;

  return (
    <div className="chat-turn__footer">
      <CopyIconButton
        text={text}
        className="chat-turn__copy"
        ariaLabel="Copy response"
        title="Copy response"
      />
    </div>
  );
}