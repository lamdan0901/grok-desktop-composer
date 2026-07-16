import type { EffortOption } from "@/lib/sessionModel";
import { ModelSelectorDropdown } from "./ModelSelectorDropdown";

type EffortSelectorProps = {
  options: EffortOption[];
  currentValue?: string;
  disabled?: boolean;
  changing?: boolean;
  onSelect: (value: string) => void;
};

export function EffortSelector({
  options,
  currentValue,
  disabled = false,
  changing = false,
  onSelect,
}: EffortSelectorProps) {
  if (options.length === 0) return null;
  const fallback = options.find((option) => option.isDefault) ?? options[0];
  const selected = currentValue ?? fallback.value;

  return (
    <ModelSelectorDropdown
      variant="session"
      choices={options.map((option) => ({
        value: option.value,
        label: option.label,
      }))}
      currentValue={selected}
      disabled={disabled}
      changing={changing}
      title="Select reasoning effort"
      ariaLabel="Reasoning effort"
      onSelect={onSelect}
    />
  );
}
