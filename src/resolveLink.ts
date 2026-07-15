import * as path from "path";

/**
 * Resolve a markdown link href to an absolute file path.
 *
 * Handles:
 * - Relative paths (e.g., "./other.md", "../dir/file.md")
 * - Wiki-link paths that may lack the .md extension
 * - Fragment / anchor stripping (e.g., "file.md#heading" → "file.md")
 * - URL-encoded characters (e.g., "%20" → " ")
 */
export function resolveMarkdownLink(
  href: string,
  currentDir: string
): string {
  // Strip fragment / anchor
  const hashIndex = href.indexOf("#");
  let filePath = hashIndex >= 0 ? href.substring(0, hashIndex) : href;

  // Decode URL-encoded characters
  try {
    filePath = decodeURIComponent(filePath);
  } catch {
    // If decoding fails, use the path as-is
  }

  // Ensure .md extension (wiki-links may omit it)
  if (!filePath.endsWith(".md")) {
    filePath += ".md";
  }

  // Resolve relative to the current document's directory
  return path.resolve(currentDir, filePath);
}

export function getMarkdownLinkFragment(href: string): string | undefined {
  const hashIndex = href.indexOf("#");
  if (hashIndex < 0 || hashIndex === href.length - 1) return undefined;

  const fragment = href.substring(hashIndex + 1);
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}
