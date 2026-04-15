# mdv — Markdown Viewer for VS Code

A rich Markdown preview that opens `.md` files as a custom editor. Built for readers and note-takers who want GFM, code highlighting, math, diagrams, wiki-links, and on-demand translation in one place.

https://github.com/user-attachments/assets/3f1548a6-e96b-4e07-8728-f3d96f220a54

## Features

- **GitHub Flavored Markdown** — tables, task lists, strikethrough, autolinks
- **Syntax highlighting** via [Shiki](https://shiki.matsu.io/) (GitHub Light theme)
- **Math** via KaTeX (`$inline$` and `$$block$$`)
- **Mermaid diagrams** with interactive zoom/pan controls
- **Wiki-links** (`[[page]]`, `[[page|alias]]`, `[[page#heading]]`) with click-through navigation
- **Image zoom/pan** — every image gets the same interactive viewport as diagrams
- **Inline SVG** — paste raw `<svg>` blocks straight into Markdown
- **Video embeds** — local video files (`.mp4`, `.webm`, `.mov`, `.ogv`) rendered inline with controls
- **Highlight marks** (`==highlighted==`)
- **Definition lists**, **superscript/subscript**, **line breaks as written**
- **Frontmatter** rendered as a clean key/value table at the top
- **Add Comment on selection** — right-click any selected text in the preview to attach a note; jump back to the exact line/selection later from the Annotations panel
- **Annotations panel** — review all comments in a dedicated panel, copy them all to the clipboard in one go (handy for feeding passages + notes back to an LLM)
- **Live reload** — the preview refreshes when the underlying file changes on disk or is saved from a text editor
- **On-demand translation** — translate the preview in place via Google Translate, no API key required

## Getting started

1. Install the extension (see below), or build from source.
2. Open any `.md` file. If VS Code opens it in the text editor, right-click the file in the Explorer and pick **Open with… → mdv Preview**, or run the `mdv: Toggle Preview / Text Editor` command.
3. Toggle between preview and the plain text editor with `Ctrl+Shift+V` (`Cmd+Shift+V` on macOS).

### Install

Grab the latest `.vsix` from the [Releases page](https://github.com/satoruhiga/vscode-mdv/releases) and run:

```bash
code --install-extension vscode-mdv-<version>.vsix
```

Or — if you use an AI coding assistant (Claude Code, Cursor, etc.) — just ask it:

> Install the latest release of `https://github.com/satoruhiga/vscode-mdv` from its GitHub Releases page.

It will fetch the `.vsix` and run the install command for you.

## Commands

| Command | Description |
| --- | --- |
| `mdv: Toggle Preview / Text Editor` | Swap the active `.md` tab between mdv preview and the plain text editor, preserving scroll position. |
| `mdv: Reload Preview` | Re-render all open mdv previews. |
| `mdv: Open with mdv` | Open a `.md` file from the Explorer context menu. |
| `mdv: Add Comment` | Annotate the current text selection in the preview. |
| `mdv: Copy All Annotations` | Copy every annotation to the clipboard as structured text. |
| `mdv: Clear Annotations` | Remove all annotations for the session. |
| `mdv: Toggle Google Translate` | Enable / disable on-demand translation of the preview. |

Most of these are also available from the preview's right-click menu.

## Annotations

Select any text in the preview, right-click, and choose **mdv: Add Comment**. The selection's file path, line range, and exact text are stored alongside your comment.

Open the **Annotations** view (in the bottom panel) to browse, copy, or clear them. Highlights on annotated lines appear live in the preview.

Annotations live in memory for the session. They are designed for quick review workflows (e.g. feeding selected passages back to an LLM), not long-term storage.

## Google Translate

Run **mdv: Toggle Google Translate** to translate the preview in place. Translation happens on-demand as you scroll, so large documents stay responsive. Code blocks, math, and diagrams are preserved. Toggle off to restore the original text.

Set the target language via `mdv.googleTranslate.targetLanguage` (e.g. `ja`, `en`, `zh-CN`). No API key required.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `mdv.fontSize` | `16` | Base font size (px) for the preview. |
| `mdv.fontFamily` | `Cascadia, Consolas, monospace` | Font family for prose and code. |
| `mdv.googleTranslate.targetLanguage` | `ja` | Target language code when translation is enabled. |
| `mdv.googleTranslate.pageLanguage` | `auto` | Source language code (`auto` to detect). |

## Building from source

```bash
git clone https://github.com/satoruhiga/vscode-mdv
cd vscode-mdv
npm install
npm run build                  # one-off build
npm run watch                  # rebuild on change
npm run package                # produce a .vsix you can install with `code --install-extension`
```

Requires VS Code 1.96 or newer.

## License

MIT
