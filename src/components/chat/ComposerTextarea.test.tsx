// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ComposerTextarea } from "./ComposerTextarea";

function SelectionHarness() {
  const [cursor, setCursor] = useState(0);

  return (
    <ComposerTextarea
      className="composer-input"
      placeholder="Message"
      value="select me"
      cursor={cursor}
      onChange={() => {}}
      onCursorChange={setCursor}
    />
  );
}

describe("ComposerTextarea", () => {
  it("preserves a selected range when cursor state updates", () => {
    render(<SelectionHarness />);

    const textarea = screen.getByPlaceholderText("Message") as HTMLTextAreaElement;
    textarea.setSelectionRange(0, textarea.value.length);
    fireEvent.select(textarea);

    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(textarea.value.length);
  });
});
