import * as vscode from "vscode";
import { MdvEditorProvider } from "./mdvEditorProvider";
import { registerToggleCommand } from "./commands";

export function activate(context: vscode.ExtensionContext) {
  const provider = new MdvEditorProvider(context);

  // Register custom editor provider
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      MdvEditorProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );

  // Register toggle command
  context.subscriptions.push(registerToggleCommand());

  // Register reload command
  context.subscriptions.push(
    vscode.commands.registerCommand("mdv.reload", () => {
      provider.refreshAll();
    })
  );

  // File watcher for auto-refresh (external changes)
  const watcher = vscode.workspace.createFileSystemWatcher("**/*.md");
  watcher.onDidChange((uri) => provider.refresh(uri));
  context.subscriptions.push(watcher);

  // Auto-refresh on text document changes (e.g. Claude Code edits)
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      const uri = e.document.uri;
      if (!uri.fsPath.endsWith(".md") || !provider.hasWebview(uri)) return;

      const key = uri.toString();
      const existing = debounceTimers.get(key);
      if (existing) clearTimeout(existing);

      debounceTimers.set(
        key,
        setTimeout(() => {
          debounceTimers.delete(key);
          provider.refresh(uri);
        }, 300)
      );
    })
  );

  // Also refresh on save from text editor
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.uri.fsPath.endsWith(".md")) {
        provider.refresh(doc.uri);
      }
    })
  );
}

export function deactivate() {}
