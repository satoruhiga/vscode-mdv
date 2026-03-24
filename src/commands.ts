import * as vscode from "vscode";
import { MdvEditorProvider } from "./mdvEditorProvider";

export function registerToggleCommand(): vscode.Disposable {
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
      await vscode.commands.executeCommand("vscode.openWith", uri, "default");
      return;
    }

    // If current tab is a text editor on a .md file, switch to mdv preview
    if (activeEditor && activeEditor.document.uri.fsPath.endsWith(".md")) {
      await vscode.commands.executeCommand(
        "vscode.openWith",
        activeEditor.document.uri,
        MdvEditorProvider.viewType
      );
    }
  });
}
