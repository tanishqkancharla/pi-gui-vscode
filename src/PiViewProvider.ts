import * as vscode from "vscode";
import { RemoteSession } from "@earendil-works/pi-coding-agent/client";
import {
  parseWebviewMessage,
  type HostMessage,
  type WebviewMessage,
} from "./shared/messages";
import { createPiRuntime, type PiRuntime } from "./host/runtime";

const LAST_SESSION_KEY = "piGui.lastSessionId";

export class PiViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "piGui.chatView";

  private view?: vscode.WebviewView;
  private runtime?: PiRuntime;
  private remote?: RemoteSession;
  private ready = false;
  private readonly pending: HostMessage[] = [];
  private unsubClient?: () => void;
  private unsubConnection?: () => void;
  private unsubRemote?: () => void;
  private unsubEvents?: () => void;
  private starting?: Promise<void>;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    this.ready = false;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "out"),
      ],
    };
    webviewView.webview.html = this.html(webviewView.webview);
    webviewView.webview.onDidReceiveMessage(async (data: unknown) => {
      const message = parseWebviewMessage(data);
      if (!message) return;
      try {
        await this.handle(message);
      } catch (error) {
        this.post({
          type: "error",
          code: "runtime",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  insertSelection(filePath: string, startLine?: number, endLine?: number): void {
    this.post({ type: "editor-selection", filePath, startLine, endLine });
  }

  async dispose(): Promise<void> {
    this.unsubClient?.();
    this.unsubConnection?.();
    this.unsubRemote?.();
    this.unsubEvents?.();
    await this.remote?.dispose();
    await this.runtime?.dispose();
  }

  private async handle(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        this.post({ type: "status", status: "connecting" });
        await this.ensureRuntime();
        this.ready = true;
        this.flush();
        await this.restoreOrCreateSession();
        this.pushServerSnapshot();
        this.pushAuthHint();
        break;
      case "prompt":
        await this.ensureRemote();
        await this.remote?.submit(message.text);
        break;
      case "steer":
        await this.ensureRemote();
        await this.remote?.submit(message.text);
        break;
      case "abort":
        await this.remote?.abort();
        break;
      case "new-session":
        await this.createSession();
        break;
      case "open-session":
        await this.openSession(message.sessionId);
        break;
      case "set-model":
        await this.remote?.setModel({ provider: message.provider, id: message.id });
        break;
      case "set-thinking":
        await this.remote?.setThinking(message.level);
        break;
      case "search-files":
        await this.searchFiles(message.query);
        break;
      case "open-file":
        await this.openFile(message.path);
        break;
    }
  }

  private async ensureRuntime(): Promise<PiRuntime> {
    if (this.runtime) return this.runtime;
    if (!this.starting) {
      this.starting = this.startRuntime();
    }
    await this.starting;
    if (!this.runtime) throw new Error("Pi runtime failed to start");
    return this.runtime;
  }

  private async startRuntime(): Promise<void> {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
    const configured = vscode.workspace
      .getConfiguration("piGui")
      .get<string>("serverSocket");
    try {
      this.runtime = await createPiRuntime({ cwd, configuredSocket: configured });
      this.post({
        type: "status",
        status: "connected",
        startedServer: this.runtime.startedServer,
        socketPath: this.runtime.socketPath,
      });
      this.unsubClient = this.runtime.client.subscribe(() => this.pushServerSnapshot());
      this.unsubConnection = this.runtime.client.onConnectionStateChange((change) => {
        if (change.state === "disconnected") {
          this.post({ type: "status", status: "disconnected" });
        }
        if (change.state === "connected") {
          this.post({
            type: "status",
            status: "connected",
            startedServer: this.runtime?.startedServer,
            socketPath: this.runtime?.socketPath,
          });
        }
      });
    } catch (error) {
      this.post({
        type: "error",
        code: "runtime",
        message: error instanceof Error ? error.message : String(error),
      });
      this.post({ type: "status", status: "disconnected" });
      throw error;
    }
  }

  private async restoreOrCreateSession(): Promise<void> {
    const last = this.context.workspaceState.get<string>(LAST_SESSION_KEY);
    const sessions = this.runtime?.client.snapshot?.sessions ?? [];
    if (last && sessions.some((session) => session.id === last)) {
      await this.openSession(last);
      return;
    }
    await this.createSession();
  }

  private async createSession(): Promise<void> {
    const client = (await this.ensureRuntime()).client;
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
    await this.bindRemote(await RemoteSession.create(client, { cwd }));
  }

  private async openSession(sessionId: string): Promise<void> {
    const client = (await this.ensureRuntime()).client;
    await this.bindRemote(await RemoteSession.open(client, sessionId));
  }

  private async bindRemote(remote: RemoteSession): Promise<void> {
    this.unsubRemote?.();
    this.unsubEvents?.();
    await this.remote?.dispose();
    this.remote = remote;
    if (remote.id) {
      await this.context.workspaceState.update(LAST_SESSION_KEY, remote.id);
    }
    this.unsubRemote = remote.subscribe((state) => {
      if (state.snapshot) {
        this.post({ type: "session-snapshot", snapshot: state.snapshot });
      }
    });
    this.unsubEvents = this.attachProgress(remote);
    if (remote.snapshot) {
      this.post({ type: "session-snapshot", snapshot: remote.snapshot });
    }
    this.pushServerSnapshot();
  }

  private attachProgress(remote: RemoteSession): () => void {
    const client = this.runtime?.client;
    if (!client) return () => {};
    return client.onEvent((event) => {
      if (event.type !== "session_progress") return;
      if (event.sessionId !== remote.id) return;
      this.post({ type: "session-progress", progress: event.progress });
    });
  }

  private async ensureRemote(): Promise<void> {
    if (!this.remote || this.remote.disposed) {
      await this.restoreOrCreateSession();
    }
  }

  private pushServerSnapshot(): void {
    const snapshot = this.runtime?.client.snapshot;
    this.post({
      type: "server-snapshot",
      sessions: (snapshot?.sessions ?? []).map((session) => ({
        id: session.id,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        sessionName: session.sessionName,
        cwd: session.cwd,
      })),
      models: (snapshot?.models ?? []).map((model) => ({
        provider: model.provider,
        id: model.id,
        name: model.name,
        authenticated: model.authenticated,
        reasoning: model.reasoning,
        supportedThinkingLevels: model.supportedThinkingLevels,
      })),
    });
  }

  private pushAuthHint(): void {
    const models = this.runtime?.client.snapshot?.models ?? [];
    const authenticated = models.some((model) => model.authenticated);
    if (!authenticated) {
      this.post({
        type: "error",
        code: "missing-key",
        message:
          "No authenticated Pi model. Set ANTHROPIC_API_KEY (or another provider key) or add credentials in ~/.pi/agent/auth.json.",
      });
    }
  }

  private async searchFiles(query: string): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      this.post({ type: "search-files-result", files: [] });
      return;
    }
    const needle = query.toLowerCase();
    const found = await vscode.workspace.findFiles("**/*", "**/node_modules/**", 200);
    const files = found
      .map((uri) => vscode.workspace.asRelativePath(uri, false))
      .filter((path) => path.toLowerCase().includes(needle))
      .slice(0, 40);
    this.post({ type: "search-files-result", files });
  }

  private async openFile(path: string): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    const uri = folder
      ? vscode.Uri.joinPath(folder.uri, path)
      : vscode.Uri.file(path);
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, { preview: true });
  }

  private post(message: HostMessage): void {
    if (this.view && this.ready) {
      void this.view.webview.postMessage(message);
      return;
    }
    this.pending.push(message);
  }

  private flush(): void {
    if (!this.view) return;
    const queued = this.pending.splice(0);
    for (const message of queued) {
      void this.view.webview.postMessage(message);
    }
  }

  private html(webview: vscode.Webview): string {
    const script = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "out", "index.js"),
    );
    const style = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "out", "index.css"),
    );
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${style}" />
  <title>Pi</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) text += chars.charAt(Math.floor(Math.random() * chars.length));
  return text;
}
