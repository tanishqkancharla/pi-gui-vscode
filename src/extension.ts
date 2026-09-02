import * as vscode from "vscode";
import { PiViewProvider } from "./PiViewProvider";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new PiViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PiViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand("piGui.addSelectionToPrompt", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const folder = vscode.workspace.workspaceFolders?.[0];
      const filePath = folder
        ? vscode.workspace.asRelativePath(editor.document.uri, false)
        : editor.document.uri.fsPath;
      const startLine = editor.selection.start.line + 1;
      const endLine = editor.selection.end.line + 1;
      const hasSelection = !editor.selection.isEmpty;
      provider.insertSelection(
        filePath,
        hasSelection ? startLine : undefined,
        hasSelection ? endLine : undefined,
      );
    }),
    { dispose: () => void provider.dispose() },
  );
}

export function deactivate(): void {}
