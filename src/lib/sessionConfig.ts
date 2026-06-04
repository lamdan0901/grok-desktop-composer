import type {
  SessionConfigOption,
  SessionConfigSelectGroup,
  SessionConfigSelectOption,
  SessionConfigSelectOptions,
} from "@agentclientprotocol/sdk";
import { formatModelName, modelChoiceLabel } from "@/lib/formatModelName";

export type ModelChoice = {
  value: string;
  label: string;
};

export type ModelSelectorState =
  | {
      source: "acp";
      configId: string;
      choices: ModelChoice[];
      currentValue: string;
      currentLabel: string;
    }
  | {
      source: "cli";
      choices: ModelChoice[];
      currentValue: string;
      currentLabel: string;
    }
  | null;

function isSelectGroup(
  entry: SessionConfigSelectOption | SessionConfigSelectGroup,
): entry is SessionConfigSelectGroup {
  return "group" in entry && "options" in entry;
}

export function flattenSelectOptions(
  options: SessionConfigSelectOptions,
): SessionConfigSelectOption[] {
  if (!options?.length) return [];
  if (isSelectGroup(options[0])) {
    return (options as SessionConfigSelectGroup[]).flatMap((g) => g.options);
  }
  return options as SessionConfigSelectOption[];
}

export function findModelConfigOption(
  configOptions: SessionConfigOption[],
): (SessionConfigOption & { type: "select" }) | null {
  for (const opt of configOptions) {
    if (opt.type !== "select") continue;
    const id = opt.id.toLowerCase();
    const name = opt.name.toLowerCase();
    if (
      opt.category === "model" ||
      id.includes("model") ||
      name.includes("model")
    ) {
      return opt;
    }
  }
  return null;
}

export function modelSelectorFromConfig(
  configOptions: SessionConfigOption[],
): ModelSelectorState {
  const modelOpt = findModelConfigOption(configOptions);
  if (!modelOpt) return null;

  const flat = flattenSelectOptions(modelOpt.options);
  if (!flat.length) return null;

  const choices = flat.map((o) => ({
    value: o.value,
    label: modelChoiceLabel(o.name, o.value),
  }));
  const current = flat.find((o) => o.value === modelOpt.currentValue);
  const currentValue = modelOpt.currentValue;
  const currentLabel = modelChoiceLabel(current?.name, currentValue);

  return {
    source: "acp",
    configId: modelOpt.id,
    choices,
    currentValue,
    currentLabel,
  };
}

export function modelSelectorFromCli(
  models: string[],
  defaultModel: string,
  override?: string,
): ModelSelectorState {
  if (!models.length) return null;

  const currentValue =
    override?.trim() ||
    defaultModel.trim() ||
    models[0] ||
    "";

  const choices = models.map((id) => ({
    value: id,
    label: formatModelName(id),
  }));
  const currentLabel =
    choices.find((c) => c.value === currentValue)?.label ??
    formatModelName(currentValue);

  return {
    source: "cli",
    choices,
    currentValue,
    currentLabel,
  };
}
export function nextModelInCycle(selector: NonNullable<ModelSelectorState>): string {
  const { choices, currentValue } = selector;
  if (choices.length <= 1) return currentValue;
  const idx = choices.findIndex((c) => c.value === currentValue);
  const nextIdx = idx < 0 ? 0 : (idx + 1) % choices.length;
  return choices[nextIdx].value;
}

export function isModelCycleKey(e: {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}): boolean {
  return (
    e.key === "Tab" &&
    e.ctrlKey &&
    !e.shiftKey &&
    !e.altKey &&
    !e.metaKey
  );
}
