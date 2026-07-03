import * as vscode from "vscode";
import { MdvEditorProvider } from "./mdvEditorProvider";
import { registerToggleCommand } from "./commands";
import { AnnotationStore, formatAllAnnotations } from "./annotations";
import { AnnotationPanelProvider } from "./annotationPanelProvider";

export function activate(context: vscode.ExtensionContext) {
  const store = new AnnotationStore();
  context.subscriptions.push({ dispose: () => store.dispose() });

  const provider = new MdvEditorProvider(context, store);

  // Register custom editor provider
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      MdvEditorProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true, enableFindWidget: true },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );

  // Register toggle command
  context.subscriptions.push(registerToggleCommand(provider));

  // Open Preview from explorer context menu
  context.subscriptions.push(
    vscode.commands.registerCommand("mdv.openPreview", (uri?: vscode.Uri) => {
      if (!uri) {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor?.document.uri.fsPath.endsWith(".md")) {
          uri = activeEditor.document.uri;
        }
      }
      if (uri) {
        vscode.commands.executeCommand("vscode.openWith", uri, MdvEditorProvider.viewType);
      }
    })
  );

  // Register reload command
  context.subscriptions.push(
    vscode.commands.registerCommand("mdv.reload", () => {
      provider.refreshAll();
    })
  );

  // Toggle Google Translate
  context.subscriptions.push(
    vscode.commands.registerCommand("mdv.toggleTranslate", async () => {
      const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
      if (!activeTab) return;
      const tabInput = activeTab.input;
      if (
        !tabInput ||
        typeof tabInput !== "object" ||
        !("viewType" in tabInput) ||
        (tabInput as any).viewType !== MdvEditorProvider.viewType
      ) return;
      const uri = (tabInput as any).uri as vscode.Uri;
      await provider.toggleTranslate(uri);
    })
  );

  // Annotation panel
  const panelProvider = new AnnotationPanelProvider(context, store);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      AnnotationPanelProvider.viewType,
      panelProvider
    )
  );

  // Add Comment command
  context.subscriptions.push(
    vscode.commands.registerCommand("mdv.addComment", async () => {
      const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
      if (!activeTab) return;
      const tabInput = activeTab.input;
      if (
        !tabInput ||
        typeof tabInput !== "object" ||
        !("viewType" in tabInput) ||
        (tabInput as any).viewType !== MdvEditorProvider.viewType
      ) return;

      const uri = (tabInput as any).uri as vscode.Uri;
      const selection = await provider.requestSelection(uri);
      if (!selection) {
        vscode.window.showWarningMessage("No text selected in preview.");
        return;
      }

      const body = await vscode.window.showInputBox({
        prompt: "Enter your comment",
        placeHolder: "Comment on the selected text...",
      });
      if (body === undefined) return;

      const relativePath = provider.getRelativePath(uri);
      store.add(
        { filePath: relativePath, lineRange: selection.lineRange, exact: selection.exact },
        body || ""
      );
      provider.sendAnnotationHighlights(uri);
    })
  );

  // Copy selected Markdown source location
  context.subscriptions.push(
    vscode.commands.registerCommand("mdv.copySelectedRange", async () => {
      const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
      if (!activeTab) return;
      const tabInput = activeTab.input;
      if (
        !tabInput ||
        typeof tabInput !== "object" ||
        !("viewType" in tabInput) ||
        (tabInput as any).viewType !== MdvEditorProvider.viewType
      ) return;

      const uri = (tabInput as any).uri as vscode.Uri;
      const selection = await provider.requestSelection(uri);
      if (!selection) {
        vscode.window.showWarningMessage("No text selected in preview.");
        return;
      }

      const relativePath = provider.getRelativePath(uri);
      const text = formatMarkdownRange(relativePath, selection.lineRange);
      await vscode.env.clipboard.writeText(text);
      vscode.window.showInformationMessage(`Copied ${text}`);
    })
  );

  // Copy All Annotations command
  context.subscriptions.push(
    vscode.commands.registerCommand("mdv.copyAllAnnotations", () => {
      const text = formatAllAnnotations(store.getAll());
      if (text) {
        vscode.env.clipboard.writeText(text);
        vscode.window.showInformationMessage("Annotations copied to clipboard.");
      }
    })
  );

  // Clear Annotations command
  context.subscriptions.push(
    vscode.commands.registerCommand("mdv.clearAnnotations", () => {
      store.clear();
    })
  );

  // Update highlights when annotations change
  store.onDidChange(() => {
    for (const uri of provider.getOpenUris()) {
      provider.sendAnnotationHighlights(uri);
    }
  });

  // File watcher for changes via other VS Code instances / editors
  const watcher = vscode.workspace.createFileSystemWatcher("**/*.md");
  watcher.onDidChange((uri) => provider.refresh(uri));
  context.subscriptions.push(watcher);

  // Refresh on save from text editor
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.uri.fsPath.endsWith(".md")) {
        provider.refresh(doc.uri);
      }
    })
  );
}

export function deactivate() {}

function formatMarkdownRange(filePath: string, lineRange: [number, number]): string {
  const [start, end] = lineRange;
  const loc = start === end ? `L${start}` : `L${start}-L${end}`;
  return `${filePath}:${loc}`;
}
