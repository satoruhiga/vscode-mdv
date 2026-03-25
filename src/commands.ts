import * as vscode from "vscode";
import { MdvEditorProvider } from "./mdvEditorProvider";

export function registerToggleCommand(provider: MdvEditorProvider): vscode.Disposable {
  return vscode.commands.registerCommand("mdv.toggleEditor", async () => {
    const activeEditor = vscode.window.activeTextEditor;
    const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;

    if (!activeTab) return;

    const tabInput = activeTab.input;

    // If current tab is a custom editor (mdv preview), switch to text editor
    if (
      tabInput &&
      typeof tabInput === "object" &&
      "viewType" in tabInput &&
      (tabInput as any).viewType === MdvEditorProvider.viewType
    ) {
      const uri = (tabInput as any).uri as vscode.Uri;
      const visibleLine = provider.getVisibleLine(uri);

      await vscode.commands.executeCommand("vscode.openWith", uri, "default");

      if (visibleLine != null) {
        // Wait for text editor to be ready, then scroll
        setTimeout(() => {
          const editor = vscode.window.activeTextEditor;
          if (editor && editor.document.uri.toString() === uri.toString()) {
            const line = Math.max(0, visibleLine - 1); // 0-based
            const range = new vscode.Range(line, 0, line, 0);
            editor.revealRange(range, vscode.TextEditorRevealType.AtTop);
            editor.selection = new vscode.Selection(line, 0, line, 0);
          }
        }, 100);
      }
      return;
    }

    // If current tab is a text editor on a .md file, switch to mdv preview
    if (activeEditor && activeEditor.document.uri.fsPath.endsWith(".md")) {
      const line = activeEditor.selection.active.line + 1; // 1-based

      await vscode.commands.executeCommand(
        "vscode.openWith",
        activeEditor.document.uri,
        MdvEditorProvider.viewType
      );

      // Send scroll message after webview is ready
      setTimeout(() => {
        provider.postMessage(activeEditor.document.uri, {
          type: "scrollToLine",
          line,
        });
      }, 200);
    }
  });
}
