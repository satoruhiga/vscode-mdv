import type { Root, Element } from "hast";
import { visit } from "unist-util-visit";

const BLOCK_TAGS = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "blockquote", "pre", "table",
  "tr", "hr", "dl", "dt", "dd", "div", "section",
]);

export function rehypeSourceLine() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (!BLOCK_TAGS.has(node.tagName)) return;
      const line = node.position?.start?.line;
      if (line == null) return;

      node.properties = node.properties || {};
      node.properties["dataLine"] = line;
    });
  };
}
