import { ShieldAlert } from "lucide-react";
import { isPlanPermissionRequest } from "@/lib/plan";
import {
  isAllowOption,
  permissionOptionLabel,
  summarizePermissionTool,
} from "@/lib/permission";
import { basenameFromPath } from "@/lib/toolPresentation";
import { usePermissionStore } from "@/stores/permissionStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function PermissionPrompt() {
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const pending = usePermissionStore((s) =>
    activeSessionId ? s.pendingBySession[activeSessionId] : undefined,
  );
  const respond = usePermissionStore((s) => s.respond);

  if (!pending || !activeSessionId) return null;
  if (isPlanPermissionRequest(pending.request)) return null;

  const { request } = pending;
  const summary = summarizePermissionTool(request);
  const pathLabel = summary.path ? basenameFromPath(summary.path) : null;

  const allowOptions = request.options.filter((o) => isAllowOption(o.kind));
  const denyOptions = request.options.filter((o) => !isAllowOption(o.kind));

  return (
    <div
      className="permission-prompt"
      role="region"
      aria-label="Tool permission request"
    >
      <div className="permission-prompt__header">
        <ShieldAlert size={18} className="permission-prompt__icon" />
        <div>
          <p className="permission-prompt__title">Permission required</p>
          <p className="permission-prompt__subtitle">
            Grok wants to run a tool before continuing.
          </p>
        </div>
      </div>

      <div className="permission-prompt__tool">
        <span className="permission-prompt__tool-name">{summary.title}</span>
        {summary.kindLabel && (
          <span className="permission-prompt__tool-kind">{summary.kindLabel}</span>
        )}
        {pathLabel && (
          <span className="permission-prompt__tool-path" title={summary.path ?? undefined}>
            {pathLabel}
          </span>
        )}
      </div>

      <div className="permission-prompt__actions">
        {allowOptions.map((option) => (
          <button
            key={option.optionId}
            type="button"
            className={`btn${option.kind === "allow_always" ? " btn--ghost" : " btn--primary"}`}
            onClick={() => respond(activeSessionId, option)}
          >
            {permissionOptionLabel(option)}
          </button>
        ))}
        {denyOptions.map((option) => (
          <button
            key={option.optionId}
            type="button"
            className="btn btn--ghost"
            onClick={() => respond(activeSessionId, option)}
          >
            {permissionOptionLabel(option)}
          </button>
        ))}
        {request.options.length === 0 && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => respond(activeSessionId, null)}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}