# vscode-mdv: VSCode Markdown ビューア拡張 設計書

## 概要

VSCode の `.md` ファイルのデフォルトエディタを、リッチな読み取り専用 Markdown プレビューに置き換える拡張機能。レンダリングパイプラインとビジュアルスタイルは、既存の [proj-mdv](C:\WORK\proj-mdv) Tauri デスクトップアプリから移植する。個人利用専用。

## ゴール

- `.md` ファイルをデフォルトで見やすいプレビューで開く
- mdv のレンダリング機能をフルセットでサポート（GFM、シンタックスハイライト、数式、ダイアグラム、フロントマター、Wiki Links）
- 同じタブ位置でプレビューとテキストエディタをスムーズに切り替え
- ライトモード固定、設定不要

## 対象外

- プレビュー内での Markdown 編集
- エディタとプレビュー間のスクロール位置同期
- カスタム CSS や設定項目
- Marketplace への公開
- ダークモード対応
- 目次生成（mdv の `remarkToc` は除外）
- ソース行追跡（mdv の `rehypeSourceLine` は除外。アノテーション機能がないため不要）

## アーキテクチャ

```
vscode-mdv/
├── src/
│   ├── extension.ts            # エントリポイント: エディタプロバイダとコマンドの登録
│   ├── mdvEditorProvider.ts    # CustomReadonlyEditorProvider の実装
│   ├── markdown/
│   │   ├── processor.ts        # unified/remark/rehype パイプライン（mdv から移植）
│   │   ├── remarkFrontmatterExtract.ts  # YAML フロントマターを vfile.data に抽出
│   │   ├── rehypeFrontmatterTable.ts    # YAML をテーブルとして描画
│   │   └── rehypeImagePath.ts           # 画像パスを Webview URI に変換
│   └── commands.ts             # プレビュー ⇄ エディタ切り替えコマンド
├── media/
│   ├── preview.css             # スタイル（素の CSS、mdv ライトモードから移植）
│   └── preview.js              # Webview 内スクリプト（Mermaid 初期化など）
├── package.json                # 拡張マニフェスト
└── tsconfig.json
```

## 拡張マニフェスト（package.json の主要部分）

```jsonc
{
  "contributes": {
    "customEditors": [
      {
        "viewType": "mdv.preview",
        "displayName": "mdv Preview",
        "selector": [{ "filenamePattern": "*.md" }],
        "priority": "default"
      }
    ],
    "commands": [
      {
        "command": "mdv.toggleEditor",
        "title": "mdv: Toggle Preview / Text Editor"
      }
    ],
    "keybindings": [
      {
        "command": "mdv.toggleEditor",
        "key": "ctrl+shift+v",
        "when": "activeCustomEditorId == 'mdv.preview' || resourceExtname == '.md'"
      }
    ]
  }
}
```

`when` 句により、キーバインドを mdv プレビューまたは `.md` テキストエディタのコンテキストにスコープし、VSCode 組み込みの Markdown プレビューコマンドとの競合を回避する。

## Custom Editor プロバイダ

### 登録

- `CustomReadonlyEditorProvider` を実装
- ビュータイプ: `mdv.preview`
- `priority: "default"` で `.md` の標準テキストエディタを置き換え

### Webview 設定

- `enableScripts: true`（Mermaid のクライアントサイドレンダリングに必要）
- `localResourceRoots`: ワークスペースフォルダ + 拡張の `media/` ディレクトリ
- `retainContextWhenHidden: true` でタブ切り替え時のスクロール位置を維持（メモリとのトレードオフだが、個人利用なので許容範囲）

### Content Security Policy

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none';
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src ${webview.cspSource} 'unsafe-inline';
    img-src ${webview.cspSource} data:;
    font-src ${webview.cspSource};">
```

- `style-src 'unsafe-inline'`: KaTeX のインラインスタイルに必要
- `script-src 'unsafe-inline'`: Mermaid が `securityLevel: "loose"` で内部的にインラインスクリプトを生成するため必要
- `img-src data:`: Mermaid の SVG data URI に必要
- CDN アクセスなし。全リソースをローカルにバンドル

### HTML 構造

```html
<html>
<head>
  <meta http-equiv="Content-Security-Policy" content="...">
  <link rel="stylesheet" href="${previewCssUri}">
  <link rel="stylesheet" href="${katexCssUri}">
</head>
<body>
  <article class="prose">
    ${renderedHtml}
  </article>
  <script src="${mermaidUri}"></script>
  <script src="${previewJsUri}"></script>
</body>
</html>
```

## Markdown レンダリングパイプライン

mdv の `processor.ts` から移植。Tauri 固有のコードは除去。

### 処理ステージ

```
remarkParse
  -> remarkFrontmatter           # YAML フロントマターノードをパース
  -> remarkFrontmatterExtract    # YAML を vfile.data に抽出（カスタム、mdv から移植）
  -> remarkWikiLink              # [[wiki links]]（GFM より前に配置し ~構文~ の競合を回避）
  -> remarkGfm                   # テーブル、タスクリスト、脚注、取り消し線
  -> remarkBreaks                # 改行 -> <br>
  -> remarkSupersub              # 上付き/下付き文字（^text^, ~text~）
  -> remarkDeflist               # 定義リスト
  -> remarkMath                  # 数式構文の認識
  -> remarkRehype                # HTML AST に変換（allowDangerousHtml: true）
  -> rehypeFrontmatterTable      # YAML をテーブルとして描画（カスタム、mdv から移植）
  -> rehypeImagePath             # 画像パスを Webview URI に変換（カスタム、書き直し）
  -> rehypeKatex                 # 数式レンダリング
  -> rehypeShiki                 # シンタックスハイライト（github-light テーマのみ）
  -> rehypeStringify             # HTML 文字列を出力（allowDangerousHtml: true）
```

### Shiki 設定

`createHighlighterCore` で言語を個別インポート（mdv と同じアプローチ）。WASM バンドルを回避し拡張サイズを最小化。JavaScript 正規表現エンジンを使用。対応言語: JavaScript, TypeScript, Python, Rust, Go, Java, C/C++, HTML, CSS, JSON, YAML, TOML, SQL, Markdown, Shell, Svelte, Mermaid。

### mdv からの変更点

| コンポーネント | mdv (Tauri) | vscode-mdv |
|-----------|-------------|------------|
| 画像パス | Tauri asset protocol | `webview.asWebviewUri()` |
| Shiki テーマ | デュアル (github-light + github-dark) | `github-light` のみ |
| Mermaid | Webview 内クライアントサイド | 同じ方式、バンドル（CDN なし） |
| ファイル I/O | Tauri IPC コマンド | VSCode `workspace.fs` API |
| remarkToc | あり | 除外 |
| rehypeSourceLine | あり（アノテーション用） | 除外（アノテーション機能なし） |

### 依存パッケージ

npm パッケージ:
- `unified`, `remark-parse`, `remark-gfm`, `remark-breaks`, `remark-math`, `remark-frontmatter`
- `remark-supersub`, `remark-deflist`, `@flowershow/remark-wiki-link`
- `remark-rehype`, `rehype-katex`, `rehype-stringify`
- `shiki`, `@shikijs/rehype`（シンタックスハイライト + rehype 連携）
- `katex`（CSS のみ、レンダリングは rehype-katex 経由）
- `mermaid`（バンドル、Webview 内で読み込み）
- `yaml`（フロントマターテーブル用 YAML パース）
- `unist-util-visit`（カスタムプラグイン用 AST 走査）

mdv から移植するカスタムプラグイン:
- `remarkFrontmatterExtract`（YAML を vfile.data に抽出）
- `rehypeFrontmatterTable`（YAML をテーブルとして描画）
- `rehypeImagePath`（Webview URI 用に書き直し）

## エディタ切り替え

### コマンド: `mdv.toggleEditor`

```typescript
vscode.commands.executeCommand("vscode.openWith", uri, "default")    // -> テキストエディタ
vscode.commands.executeCommand("vscode.openWith", uri, "mdv.preview") // -> プレビュー
```

- アクティブエディタが mdv プレビューの場合: ビュータイプ `"default"` でテキストエディタを開く
- アクティブエディタが `.md` のテキストエディタの場合: ビュータイプ `"mdv.preview"` でプレビューに戻る

### キーバインド

- `Ctrl+Shift+V`。`when` 句で mdv プレビューまたは `.md` テキストエディタのコンテキストにスコープ

## 自動リフレッシュ

- **`FileSystemWatcher`**（`**/*.md` パターン）: ファイル変更検知の主要メカニズム（外部エディタ、git 操作など）。ワークスペースフォルダにスコープ。
- **`workspace.onDidSaveTextDocument`**: テキストエディタに切り替えて保存した後、プレビューに戻った時の再レンダリング用。

注意: `CustomReadonlyEditorProvider` がアクティブな場合、対応する `TextDocument` はオープンされていない。その場合は `FileSystemWatcher` がリフレッシュを担当する。`onDidSaveTextDocument` は「エディタに切り替え → 編集・保存 → プレビューに戻る」ワークフローを補完する。

## スタイリング

### 方針

`media/preview.css` に素の CSS で記述。Tailwind や CSS フレームワークは不使用。mdv のライトモード出力からスタイルを抽出し、直接 CSS ルールとして記述する。

### 主なスタイル要素

- **フォント**: Cascadia / Consolas モノスペース、固定サイズ
- **見出し**: サイズ階層と適切な余白
- **コードブロック**: `background: #f8fafc`, `border-radius: 3px`, `padding: 0.75rem`
- **インラインコード**: 黄色マーカー背景 `#fffb91`
- **フロントマターテーブル**: ボーダー付きテーブル
- **チェックボックス**: 青チェックのカスタムスタイル
- **Mermaid コンテナ**: 白背景、SVG センタリング
- **KaTeX**: `katex.min.css` を `media/` にバンドル
- **ブロッククォート**: 左ボーダーアクセント
- **リンク**: 青色。Wiki Links は破線アンダーライン
- **テーブル**: GFM テーブルスタイル、ボーダー付き

### テーマ

ライトモード固定。mdv のカラーパレット（slate/gray/blue/yellow）を使用。

## エラーハンドリング

- **Markdown パースエラー**: Webview 上部にエラーバナーを表示し、その下に生の Markdown テキストをフォールバック表示。
- **Mermaid レンダリングエラー**: ダイアグラムコンテナ内にエラーメッセージをインライン表示（mdv と同じ方式）。
- **ファイル読み取りエラー**: Webview にエラーメッセージを表示（例: 「ファイルの読み取りに失敗しました」）。
