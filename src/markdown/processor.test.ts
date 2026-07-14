import { describe, expect, it } from "vitest";
import { processMarkdown } from "./processor";

describe("processMarkdown video embeds", () => {
  const basePath = "/workspace/notes/index.md";
  const convertFileSrc = (path: string) => `webview:${path}`;

  it("rewrites raw video src attributes to webview URIs", async () => {
    const result = await processMarkdown(
      '<video controls width="100%" src="./artifacts/preview.mp4"></video>',
      { basePath, convertFileSrc }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.html).toContain('src="webview:/workspace/notes/artifacts/preview.mp4"');
    expect(result.html).toContain('data-original-path="/workspace/notes/artifacts/preview.mp4"');
  });

  it("rewrites source elements inside raw videos", async () => {
    const result = await processMarkdown(
      '<video controls><source src="./artifacts/preview.webm" type="video/webm"></video>',
      { basePath, convertFileSrc }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.html).toContain('<source src="webview:/workspace/notes/artifacts/preview.webm"');
  });

  it("turns markdown image links to videos before rewriting paths", async () => {
    const result = await processMarkdown(
      "![preview](./artifacts/preview.mp4)",
      { basePath, convertFileSrc }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.html).toContain('<video src="webview:/workspace/notes/artifacts/preview.mp4"');
    expect(result.html).toContain("controls loop muted playsinline");
  });
});

describe("processMarkdown source lines", () => {
  it("adds start and end source lines for multi-line list items", async () => {
    const result = await processMarkdown("- first line\n  continued line");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.html).toContain('data-line="1"');
    expect(result.html).toContain('data-line-end="2"');
  });
});

describe("processMarkdown CJK emphasis", () => {
  it("renders bold text ending in punctuation before Japanese text", async () => {
    const result = await processMarkdown(
      "入力の **5.547%**を落とし、maskは **`z<=85°`**を採用する"
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.html).toContain("<strong>5.547%</strong>を落とし");
    expect(result.html).toContain("<strong><code>z&#x3C;=85°</code></strong>を採用する");
  });

  it("keeps standard bold syntax working", async () => {
    const result = await processMarkdown("値は **31,860 splat** に固定する");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.html).toContain("<strong>31,860 splat</strong> に固定する");
  });
});

describe("processMarkdown superscript and subscript", () => {
  it("does not treat approximate values as subscript delimiters", async () => {
    const result = await processMarkdown(
      "Detect AprilGrid は off ~3 分 / prior_guided ~9 分。差 ~560s / ~144MB"
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.html).not.toContain("<sub>");
    expect(result.html).toContain("off ~3 分 / prior_guided ~9 分");
    expect(result.html).toContain("差 ~560s / ~144MB");
  });

  it("renders compact Pandoc-style superscript and subscript", async () => {
    const result = await processMarkdown("H~2~O, E = mc^2^, and ~~removed~~");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.html).toContain("H<sub>2</sub>O");
    expect(result.html).toContain("mc<sup>2</sup>");
    expect(result.html).toContain("<del>removed</del>");
  });
});
