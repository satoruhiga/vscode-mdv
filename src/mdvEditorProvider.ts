import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { processMarkdown } from "./markdown/processor";
import { AnnotationStore } from "./annotations";
import { resolveMarkdownLink } from "./resolveLink";

export class MdvEditorProvider implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = "mdv.preview";

  private readonly webviews = new Map<string, vscode.WebviewPanel>();
  private readonly fileWatchers = new Map<string, fs.FSWatcher>();
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly visibleLines = new Map<string, number>();
  private readonly pendingSelectionResolves = new Map<string, (sel: any) => void>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly annotationStore: AnnotationStore
  ) {}

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.CustomDocument> {
    return { uri, dispose: () => {} };
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const uri = document.uri;
    this.webviews.set(uri.toString(), webviewPanel);

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "media"),
        ...(vscode.workspace.workspaceFolders?.map((f) => f.uri) ?? []),
      ],
    };

    webviewPanel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === "visibleLine" && typeof msg.line === "number") {
        this.visibleLines.set(uri.toString(), msg.line);
      }
      if (msg.type === "selectionResult") {
        const resolve = this.pendingSelectionResolves.get(uri.toString());
        if (resolve) {
          this.pendingSelectionResolves.delete(uri.toString());
          resolve(msg.selection);
        }
      }
      if (msg.type === "openFile" && typeof msg.href === "string") {
        this.handleOpenFile(uri, msg.href);
      }
    });

    webviewPanel.onDidDispose(() => {
      this.webviews.delete(uri.toString());
      this.visibleLines.delete(uri.toString());
      this.stopWatching(uri);
    });

    this.startWatching(uri);
    await this.updateWebview(webviewPanel, uri);
  }

  public async refresh(uri: vscode.Uri): Promise<void> {
    const panel = this.webviews.get(uri.toString());
    if (panel) {
      await this.updateWebview(panel, uri);
    }
  }

  public async refreshAll(): Promise<void> {
    for (const [uriStr, panel] of this.webviews) {
      await this.updateWebview(panel, vscode.Uri.parse(uriStr));
    }
  }

  public hasWebview(uri: vscode.Uri): boolean {
    return this.webviews.has(uri.toString());
  }

  public getVisibleLine(uri: vscode.Uri): number | undefined {
    return this.visibleLines.get(uri.toString());
  }

  public postMessage(uri: vscode.Uri, message: unknown): void {
    const panel = this.webviews.get(uri.toString());
    if (panel) {
      panel.webview.postMessage(message);
    }
  }

  public requestSelection(uri: vscode.Uri): Promise<{ exact: string; lineRange: [number, number] } | null> {
    const key = uri.toString();
    return new Promise((resolve) => {
      this.pendingSelectionResolves.set(key, resolve);
      this.postMessage(uri, { type: "requestSelection" });
      setTimeout(() => {
        if (this.pendingSelectionResolves.get(key) === resolve) {
          this.pendingSelectionResolves.delete(key);
          resolve(null);
        }
      }, 1000);
    });
  }

  public sendAnnotationHighlights(uri: vscode.Uri): void {
    const relativePath = this.getRelativePath(uri);
    const annotations = this.annotationStore.getByFile(relativePath);
    const lineRanges = annotations.map((a) => a.target.lineRange);
    this.postMessage(uri, { type: "updateAnnotationHighlights", lineRanges });
  }

  public getRelativePath(uri: vscode.Uri): string {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (folder) {
      return uri.fsPath.slice(folder.uri.fsPath.length + 1).replace(/\\/g, "/");
    }
    return uri.fsPath.replace(/\\/g, "/");
  }

  public getOpenUris(): vscode.Uri[] {
    return Array.from(this.webviews.keys()).map((s) => vscode.Uri.parse(s));
  }

  private async handleOpenFile(
    currentUri: vscode.Uri,
    href: string
  ): Promise<void> {
    const currentDir = path.dirname(currentUri.fsPath);
    const resolvedPath = resolveMarkdownLink(href, currentDir);

    const targetUri = vscode.Uri.file(resolvedPath);
    try {
      await vscode.commands.executeCommand("vscode.open", targetUri);
    } catch {
      // File might not exist — silently ignore
    }
  }

  private startWatching(uri: vscode.Uri): void {
    const key = uri.toString();
    this.stopWatching(uri);

    try {
      const watcher = fs.watch(uri.fsPath, () => {
        const existing = this.debounceTimers.get(key);
        if (existing) clearTimeout(existing);

        this.debounceTimers.set(
          key,
          setTimeout(() => {
            this.debounceTimers.delete(key);
            this.refresh(uri);
          }, 300)
        );
      });
      this.fileWatchers.set(key, watcher);
    } catch {
      // File might not exist yet, ignore
    }
  }

  private stopWatching(uri: vscode.Uri): void {
    const key = uri.toString();
    const watcher = this.fileWatchers.get(key);
    if (watcher) {
      watcher.close();
      this.fileWatchers.delete(key);
    }
    const timer = this.debounceTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(key);
    }
  }

  private async updateWebview(
    panel: vscode.WebviewPanel,
    uri: vscode.Uri
  ): Promise<void> {
    const content = await vscode.workspace.fs.readFile(uri);
    const markdownText = Buffer.from(content).toString("utf-8");

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    const convertFileSrc = (absolutePath: string) => {
      const fileUri = vscode.Uri.file(absolutePath);
      return panel.webview.asWebviewUri(fileUri).toString();
    };

    const result = await processMarkdown(markdownText, {
      basePath: uri.fsPath,
      rootPath: workspaceFolder?.uri.fsPath,
      convertFileSrc,
    });

    const html = result.ok
      ? result.html
      : `<div class="error-banner">${escapeHtml(result.error)}</div><pre>${escapeHtml(markdownText)}</pre>`;

    panel.webview.html = this.getHtmlForWebview(panel.webview, html);
  }

  private getHtmlForWebview(webview: vscode.Webview, bodyHtml: string): string {
    const mediaUri = vscode.Uri.joinPath(this.context.extensionUri, "media");
    const previewCssUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, "preview.css"));
    const katexCssUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, "katex", "katex.min.css"));
    const mermaidJsUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, "mermaid.min.js"));
    const previewJsUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, "preview.js"));
    const cspSource = webview.cspSource;

    const config = vscode.workspace.getConfiguration("mdv");
    const fontSize = config.get<number>("fontSize", 16);
    const fontFamily = config.get<string>("fontFamily", "Cascadia, Consolas, monospace");

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
      style-src ${cspSource} 'unsafe-inline';
      script-src ${cspSource} 'unsafe-inline';
      img-src ${cspSource} data: https:;
      media-src ${cspSource} https:;
      font-src ${cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${katexCssUri}">
  <link rel="stylesheet" href="${previewCssUri}">
  <style>
    html, body { font-family: ${fontFamily}; }
    .prose { font-size: ${fontSize}px; }
    .prose pre code, .shiki code { font-family: ${fontFamily}; }
  </style>
</head>
<body data-vscode-context='{"webviewSection": "preview"}'>
  <article class="prose">
    ${bodyHtml}
  </article>
  <script src="${mermaidJsUri}"></script>
  <script src="${previewJsUri}"></script>
</body>
</html>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
