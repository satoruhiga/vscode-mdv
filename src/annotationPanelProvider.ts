import * as vscode from "vscode";
import { AnnotationStore, formatAllAnnotations } from "./annotations";

export class AnnotationPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "mdv.annotationPanel";
  private view?: vscode.WebviewView;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly store: AnnotationStore
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "media"),
      ],
    };

    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg.type === "delete") {
        this.store.remove(msg.id);
      }
      if (msg.type === "update") {
        this.store.update(msg.id, msg.body);
      }
      if (msg.type === "copyAll") {
        const text = formatAllAnnotations(this.store.getAll());
        if (text) {
          vscode.env.clipboard.writeText(text);
        }
      }
    });

    const changeListener = this.store.onDidChange(() => this.refresh());
    webviewView.onDidDispose(() => changeListener.dispose());

    this.refresh();
  }

  refresh(): void {
    if (!this.view) return;
    const annotations = this.store.getAll();
    this.view.webview.html = this.getHtml(this.view.webview, annotations);
  }

  private getHtml(webview: vscode.Webview, annotations: any[]): string {
    const mediaUri = vscode.Uri.joinPath(this.context.extensionUri, "media");
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(mediaUri, "annotation-panel.css")
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(mediaUri, "annotation-panel.js")
    );
    const cspSource = webview.cspSource;

    const annotationsJson = JSON.stringify(annotations)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e");

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
      style-src ${cspSource} 'unsafe-inline';
      script-src ${cspSource} 'unsafe-inline';
      font-src ${cspSource};">
  <link rel="stylesheet" href="${cssUri}">
</head>
<body>
  <div id="root"></div>
  <script>window.__annotations = ${annotationsJson};</script>
  <script src="${jsUri}"></script>
</body>
</html>`;
  }
}
