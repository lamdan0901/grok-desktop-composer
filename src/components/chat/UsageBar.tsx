import {
  contextBarClass,
  contextUsageLevel,
  formatTokenCount,
  hasContextUsageData,
} from "@/lib/usage";
import { useUsageStore } from "@/stores/usageStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

function contextUsageLabel(
  pct: number,
  used: number,
  window: number,
): string {
  return `${pct}% · ${formatTokenCount(used)} / ${formatTokenCount(window)}`;
}

export function UsageBar() {
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const entry = useUsageStore((s) =>
    activeSessionId != null ? s.bySession[activeSessionId] : undefined,
  );
  const setOverlayOpen = useUsageStore((s) => s.setOverlayOpen);

  const signals = entry?.signals;
  const pct = signals?.contextWindowUsage ?? 0;
  const usageLevel = contextUsageLevel(pct);
  const hasData = hasContextUsageData(signals);
  const detailLabel = hasData
    ? contextUsageLabel(
        pct,
        signals!.contextTokensUsed,
        signals!.contextWindowTokens,
      )
    : null;

  if (!activeSessionId) return null;

  return (
    <button
      type="button"
      className={`usage-bar${usageLevel !== "normal" ? ` usage-bar--${usageLevel}` : ""}`}
      title={detailLabel ?? "View session and subscription usage"}
      aria-label={
        detailLabel ? `Context ${detailLabel}` : "View session and subscription usage"
      }
      onClick={() => setOverlayOpen(true)}
    >
      {hasData ? (
        <>
          <span className="usage-bar__track" aria-hidden>
            <span
              className={`usage-bar__fill ${contextBarClass(pct)}`}
              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            />
          </span>
          <span className="usage-bar__label">{detailLabel}</span>
        </>
      ) : (
        <span className="usage-bar__label usage-bar__label--idle">Usage</span>
      )}
    </button>
  );
}