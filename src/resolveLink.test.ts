import { describe, it, expect } from "vitest";
import * as path from "path";
import { resolveMarkdownLink } from "./resolveLink";

describe("resolveMarkdownLink", () => {
  const baseDir = "/workspace/docs";

  it("resolves a simple .md link", () => {
    const result = resolveMarkdownLink("other.md", baseDir);
    expect(result).toBe(path.resolve(baseDir, "other.md"));
  });

  it("resolves a relative path with directory traversal", () => {
    const result = resolveMarkdownLink("../notes/readme.md", baseDir);
    expect(result).toBe(path.resolve(baseDir, "../notes/readme.md"));
  });

  it("resolves a ./ prefixed path", () => {
    const result = resolveMarkdownLink("./sub/file.md", baseDir);
    expect(result).toBe(path.resolve(baseDir, "./sub/file.md"));
  });

  it("strips fragment/anchor from href", () => {
    const result = resolveMarkdownLink("other.md#heading", baseDir);
    expect(result).toBe(path.resolve(baseDir, "other.md"));
  });

  it("appends .md extension when missing (wiki-link style)", () => {
    const result = resolveMarkdownLink("wiki-page", baseDir);
    expect(result).toBe(path.resolve(baseDir, "wiki-page.md"));
  });

  it("appends .md and strips fragment for wiki-link with heading", () => {
    const result = resolveMarkdownLink("wiki-page#section", baseDir);
    expect(result).toBe(path.resolve(baseDir, "wiki-page.md"));
  });

  it("does not double-append .md if already present", () => {
    const result = resolveMarkdownLink("already.md", baseDir);
    expect(result).toBe(path.resolve(baseDir, "already.md"));
  });

  it("decodes URL-encoded characters", () => {
    const result = resolveMarkdownLink("my%20file.md", baseDir);
    expect(result).toBe(path.resolve(baseDir, "my file.md"));
  });

  it("decodes URL-encoded characters in wiki-link without .md", () => {
    const result = resolveMarkdownLink("my%20page", baseDir);
    expect(result).toBe(path.resolve(baseDir, "my page.md"));
  });

  it("handles subdirectory wiki-link path", () => {
    const result = resolveMarkdownLink("sub/nested-page", baseDir);
    expect(result).toBe(path.resolve(baseDir, "sub/nested-page.md"));
  });
});
