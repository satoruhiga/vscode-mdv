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
