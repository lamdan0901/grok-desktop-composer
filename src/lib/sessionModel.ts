/**
 * Model state carried on ACP session responses. SDK 0.24 does not type the
 * `models` field yet, so we declare it locally; grok attaches it via `.models(...)`
 * on new/load/resume responses (verified: xai-grok-pager acp/model_state.rs).
 */
export interface ModelInfo {
  modelId: string;
  name?: string;
  description?: string;
  meta?: Record<string, unknown>;
}
export interface SessionModelState {
  availableModels: ModelInfo[];
  currentModelId: string;
}

export interface EffortOption {
  value: string;
  label: string;
  isDefault: boolean;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Parse the model-declared reasoning-effort menu from one `ModelInfo.meta` blob.
 * Accepts either full option tables ({id,value,label,default}) or bare value
 * strings ("xhigh"), matching grok's `RawReasoningEffortOption` wire shape.
 */
export function parseReasoningEfforts(
  meta: Record<string, unknown> | null | undefined,
): EffortOption[] {
  if (!meta || meta.supportsReasoningEffort !== true) return [];
  const raw = meta.reasoningEfforts;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): EffortOption | null => {
      if (typeof item === "string") {
        return { value: item, label: titleCase(item), isDefault: false };
      }
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        if (typeof o.value !== "string") return null;
        return {
          value: o.value,
          label: typeof o.label === "string" ? o.label : titleCase(o.value),
          isDefault: o.default === true,
        };
      }
      return null;
    })
    .filter((e): e is EffortOption => e !== null);
}

/** Current effort value from one selected model's `meta`, if any. */
export function currentReasoningEffort(
  meta: Record<string, unknown> | null | undefined,
): string | undefined {
  const value = meta?.reasoningEffort;
  return typeof value === "string" ? value : undefined;
}
