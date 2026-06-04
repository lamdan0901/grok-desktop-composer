import { LogIn, RefreshCw } from "lucide-react";
import { useGrokStore } from "@/stores/grokStore";

export function LoginGate() {
  const cli = useGrokStore((s) => s.cli);
  const auth = useGrokStore((s) => s.auth);
  const loginPending = useGrokStore((s) => s.loginPending);
  const signIn = useGrokStore((s) => s.signIn);
  const refresh = useGrokStore((s) => s.refresh);

  if (!cli?.ready) {
    return (
      <div className="login-gate">
        <div className="login-gate__card">
          <h1>Grok CLI not found</h1>
          <p className="login-gate__hint">
            {cli?.error ??
              "Install the Grok Build CLI and ensure grok.exe is on your PATH, or set a path override in Settings."}
          </p>
          <button type="button" className="btn btn--ghost" onClick={() => void refresh()}>
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-gate">
      <div className="login-gate__card">
        <h1>Sign in with Grok</h1>
        <p className="login-gate__hint">
          Desktop Composer uses your Grok CLI credentials. A terminal window will open
          for OAuth sign-in.
        </p>
        {cli.version && (
          <p className="login-gate__meta">CLI: {cli.version}</p>
        )}
        {auth?.message && !auth.authenticated && (
          <p className="login-gate__status">{auth.message}</p>
        )}
        <button
          type="button"
          className="btn btn--primary"
          disabled={loginPending}
          onClick={() => void signIn()}
        >
          <LogIn size={16} />
          {loginPending ? "Waiting for sign-in…" : "Sign in with Grok"}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ marginTop: 8 }}
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} />
          Check again
        </button>
      </div>
    </div>
  );
}