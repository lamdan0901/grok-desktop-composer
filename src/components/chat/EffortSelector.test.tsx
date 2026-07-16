// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EffortSelector } from "./EffortSelector";

describe("EffortSelector", () => {
  it("renders model-provided options and returns the selected value", () => {
    const onSelect = vi.fn();
    render(
      <EffortSelector
        options={[
          { value: "minimal", label: "Minimal", isDefault: false },
          { value: "xhigh", label: "XHigh", isDefault: true },
        ]}
        currentValue="xhigh"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reasoning effort" }));
    expect(screen.getByRole("menuitem", { name: "Minimal" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "Minimal" }));

    expect(onSelect).toHaveBeenCalledWith("minimal");
  });

  it("does not render when the model declares no effort options", () => {
    const { container } = render(<EffortSelector options={[]} onSelect={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
