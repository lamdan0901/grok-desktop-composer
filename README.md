# Grok Desktop Composer

A desktop GUI for the [Grok Build CLI](https://grok.com) — chat-first agent sessions with a workspace sidebar (projects, threads, sub-agents). Built with **Tauri 2**, **React**, **TypeScript**, and **Rust**.

The app talks to Grok through **ACP** (`grok agent stdio`): one agent process per chat thread, with permissions, plans, and session history synced from the CLI’s on-disk layout under `~/.grok/`.

## Prerequisites

| Requirement          | Notes                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Grok CLI**         | Install and ensure `grok` is on your `PATH`, or set a custom path in **Settings → Grok CLI path**. Verify with `grok -v`. |
| **Node.js**          | v18+ recommended (npm included).                                                                                          |
| **Rust**             | Install via [rustup](https://rustup.rs/).                                                                                 |
| **Platform tooling** | See below.                                                                                                                |

### Windows (primary platform)

- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with **Desktop development with C++**
- **WebView2** (usually already installed on Windows 10/11)

### macOS / Linux (development)

- **macOS:** Xcode Command Line Tools (`xcode-select --install`)
- **Linux:** Standard build essentials (`build-essential`, `pkg-config`, `libwebkit2gtk-4.1-dev`, etc. — see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))

## Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd desktop-composer
   ```

2. **Install frontend dependencies**

   ```bash
   npm install
   ```

3. **Sign in to Grok**

   The app uses the same credentials as the CLI. From a terminal:

   ```bash
   grok login
   ```

   Or use **OAuth** via `grok login --oauth`. You can also trigger login from the in-app **Settings** panel.

4. **Verify the CLI**

   ```bash
   grok -v
   grok models
   ```

   The second command should succeed when you are authenticated.

## Development

Start the desktop app with hot reload (Vite on port `1420` + Tauri):

```bash
npm run tauri dev
```

Other scripts:

| Command           | Description                                        |
| ----------------- | -------------------------------------------------- |
| `npm run dev`     | Frontend only (Vite)                               |
| `npm run build`   | Typecheck + production frontend build              |
| `npm run preview` | Preview the built frontend                         |
| `npm run tauri`   | Tauri CLI passthrough (e.g. `npm run tauri build`) |

On first launch, open **Settings** to confirm CLI version, auth status, and optional defaults (model, permission mode, theme).

## Production build

### Windows

Release installers are configured for **MSI** and **NSIS**:

```bash
npm run tauri build
```

Artifacts are written under `src-tauri/target/release/bundle/`.

### macOS / Linux

The project is developed and tested primarily on **Windows**. Production bundles for **macOS** and **Linux** are not maintained in-tree yet (`tauri.conf.json` currently targets Windows installers only).

If you have access to those platforms, you can still build locally after adjusting bundle targets in `src-tauri/tauri.conf.json` per the [Tauri bundling docs](https://v2.tauri.app/distribute/).

## Configuration

Settings are persisted by the Tauri backend (permission mode, default model, theme, workspace tabs, etc.). Notable options:

- **Grok CLI path** — leave empty to use `grok` from `PATH`, or set an absolute path to the executable.
- **Permission mode** — passed to `grok agent stdio` as `--permission-mode` when not `default`.
- **Projects** — add folders from the sidebar; each thread runs `grok agent stdio` with that project’s working directory.

Session data, plans, and history live under the Grok CLI data directory (e.g. `%USERPROFILE%\.grok\` on Windows, `~/.grok/` on Unix).

## Project layout

```
desktop-composer/
├── src/                 # React UI (chat, sidebar, settings)
├── src-tauri/           # Rust backend (Grok process manager, file watchers)
├── docs/spikes/         # Integration notes and spikes
```

## Contributing

Contributions are welcome.

**macOS and Linux production builds** are especially appreciated: CI, bundle targets (`.dmg`, `.AppImage`, `.deb`, etc.), platform-specific fixes (paths, login console, WebKit/GTK deps), and smoke-test notes. Open an issue or PR if you can validate `npm run tauri build` on your OS.

## License

MIT License
