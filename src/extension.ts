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

  // Register reload command
  context.subscriptions.push(
    vscode.commands.registerCommand("mdv.reload", () => {
      provider.refreshAll();
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

  // Add Comment command — show inline input in the preview webview
  let pendingCommentSelection: { uri: vscode.Uri; exact: string; lineRange: [number, number] } | null = null;

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

      pendingCommentSelection = { uri, exact: selection.exact, lineRange: selection.lineRange };
      provider.postMessage(uri, {
        type: "showCommentInput",
        x: selection.x ?? 100,
        y: selection.y ?? 100,
      });
    })
  );

  // Handle comment submit/cancel from webview
  provider.onCommentMessage((msg, uri) => {
    if (msg.type === "commentSubmit" && pendingCommentSelection) {
      const { exact, lineRange } = pendingCommentSelection;
      const relativePath = provider.getRelativePath(pendingCommentSelection.uri);
      store.add({ filePath: relativePath, lineRange, exact }, msg.body || "");
      provider.sendAnnotationHighlights(pendingCommentSelection.uri);
      pendingCommentSelection = null;
    }
    if (msg.type === "commentCancel") {
      pendingCommentSelection = null;
    }
  });

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
