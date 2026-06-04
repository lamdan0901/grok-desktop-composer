import { LoginGate } from "@/components/auth/LoginGate";
import { AppShell } from "@/components/layout/AppShell";
import { useGrokBootstrap } from "@/hooks/useGrokBootstrap";
import { useSettingsBootstrap } from "@/hooks/useSettings";
import { useGrokStore } from "@/stores/grokStore";

export default function App() {
  const settingsLoaded = useSettingsBootstrap();
  const grokLoaded = useGrokBootstrap();
  const cli = useGrokStore((s) => s.cli);
  const auth = useGrokStore((s) => s.auth);

  if (!settingsLoaded || !grokLoaded) {
    return (
      <div className="app-shell" style={{ alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--text-muted)" }}>Loading…</span>
      </div>
    );
  }

  if (!cli?.ready || !auth?.authenticated) {
    return <LoginGate />;
  }

  return <AppShell />;
}