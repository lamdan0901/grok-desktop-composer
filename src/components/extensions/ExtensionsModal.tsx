import { X } from "lucide-react";
import { McpServersPanel } from "@/components/settings/McpServersPanel";
import { useExtensionsStore, type ExtensionTab } from "@/stores/extensionsStore";
import { SkillsPanel } from "./SkillsPanel";
import { HooksPanel } from "./HooksPanel";

const TABS: Array<[ExtensionTab, string]> = [
  ["skills", "Skills"],
  ["hooks", "Hooks"],
  ["plugins", "Plugins"],
  ["marketplace", "Marketplace"],
  ["mcp", "MCP"],
];

export function ExtensionsModal() {
  const { open, activeTab, closeModal, setTab } = useExtensionsStore();
  if (!open) return null;

  return (
    <div className="extensions-overlay" role="presentation" onClick={closeModal}>
      <aside
        className="extensions-modal"
        role="dialog"
        aria-labelledby="extensions-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="extensions-modal__header">
          <h2 id="extensions-title">Extensions</h2>
          <button type="button" aria-label="Close extensions" onClick={closeModal}>
            <X size={18} />
          </button>
        </header>
        <div className="extensions-modal__tabs" role="tablist" aria-label="Extensions">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="extensions-modal__body">
          {activeTab === "mcp" && <McpServersPanel />}
          {(activeTab === "plugins" || activeTab === "marketplace") && (
            <p>Not available yet. This tab will be enabled after the plugin protocol is required.</p>
          )}
          {activeTab === "skills" && <SkillsPanel />}
          {activeTab === "hooks" && <HooksPanel />}
        </div>
      </aside>
    </div>
  );
}
