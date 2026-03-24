import * as vscode from "vscode";
import { processMarkdown } from "./markdown/processor";

export class MdvEditorProvider implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = "mdv.preview";

  private readonly webviews = new Map<string, vscode.WebviewPanel>();

  constructor(private readonly context: vscode.ExtensionContext) {}

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

    webviewPanel.onDidDispose(() => {
      this.webviews.delete(uri.toString());
    });

    await this.updateWebview(webviewPanel, uri);
  }

  public async refresh(uri: vscode.Uri): Promise<void> {
    const panel = this.webviews.get(uri.toString());
    if (panel) {
      await this.updateWebview(panel, uri);
    }
  }

  public hasWebview(uri: vscode.Uri): boolean {
    return this.webviews.has(uri.toString());
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
      img-src ${cspSource} data:;
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
<body>
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
