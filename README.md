# Pi GUI

A VS Code sidebar for [Pi](https://github.com/earendil-works/pi). The chrome matches [OpenCode GUI](https://github.com/saffron-health/opencode-gui) (activity-bar view, session switcher, transcript with tool cards, composer). The webview is a renderer; the extension host is a `PiClient`.

Installing the extension is enough. It bundles `@earendil-works/pi-coding-agent`, `pi-server`, and `pi-client`, and starts a local Unix `PiServer` when nothing is already listening. No `pi` binary, global npm install, or separate CLI is required.

If you already use the Pi CLI, the sidebar shares `~/.pi/agent` (auth, models, sessions) and will connect to an existing GUI socket instead of starting a second server.

## Try it out

Public GitHub: [tanishqkancharla/pi-gui-vscode](https://github.com/tanishqkancharla/pi-gui-vscode)

```bash
git clone https://github.com/tanishqkancharla/pi-gui-vscode.git
cd pi-gui-vscode
pnpm install
pnpm build
```

Press **F5** (`Run Extension`) in VS Code or Cursor. An Extension Development Host window opens. Click the Pi mark in the activity bar.

To install it in your normal VS Code window:

```bash
pnpm package
code --install-extension pi-gui-0.1.0.vsix
```

You still need Pi auth in `~/.pi/agent` (run `pi` and `/login`, or set a provider API key). Then reload the window.

This is **not** on the VS Code Marketplace.

## Requirements

- VS Code 1.96 or later
- Node.js 24 or later to run the `pi` CLI (`/login` uses undici, which needs `zlib.createZstdDecompress`). Node 22.19+ is enough to *build* the extension.

Auth still comes from Pi’s normal places: `~/.pi/agent/auth.json`, `models.json`, and environment keys such as `ANTHROPIC_API_KEY`. Missing credentials show an in-sidebar error, not an “install the CLI” prompt.

To log in with the CLI (same files the sidebar reads):

```bash
pi          # then /login in the TUI
```

If the sidebar was already open, reload the VS Code window afterward.

## Develop

```bash
pnpm install
pnpm build
pnpm watch   # rebuild extension + webview on change
```

Press **F5** (`Run Extension`) to open an Extension Development Host. The Pi view is in the activity bar.

```bash
pnpm test
pnpm spec    # serve specs/pi-gui.md on http://127.0.0.1:43117
```

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `piGui.serverSocket` | empty | Unix socket path. Empty uses `~/.pi/agent/gui.sock`. If something is already listening there, the extension connects and does not start a second server. |

Discovery on activate:

1. `piGui.serverSocket` if set
2. Else the default socket, if it already accepts connections
3. Else start the bundled `PiServer` pointed at `~/.pi/agent` and the workspace cwd

## Commands

- **Pi GUI: Add Selection to Prompt** — inserts `@path#Lstart-Lend` into the composer

## Architecture

```
SolidJS webview  --postMessage-->  extension host (PiClient)
                                     |
                              Unix socket (pi-protocol)
                                     |
                               PiServer + CodingAgentServerService
                                     |
                          createAgentSession + ~/.pi/agent
```

`session_snapshot` is the committed transcript. `session_progress` (`assistant_delta`) paints streaming tokens and is not merged into saved state.

## Spec

Design and phased implementation notes live in [`specs/pi-gui.md`](specs/pi-gui.md). Serve it with `pnpm spec`.
