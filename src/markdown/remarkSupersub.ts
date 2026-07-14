import type { Root, Text } from "mdast";
import { visit } from "unist-util-visit";

const supersubPattern = /(?<![~^])([~^])([^\s~^]+)\1(?![~^])/g;

export function remarkSupersub() {
  return (tree: Root) => {
    visit(tree, "text", (node: Text, index, parent) => {
      if (index === undefined || !parent) return;

      const children = [];
      let cursor = 0;

      for (const match of node.value.matchAll(supersubPattern)) {
        const offset = match.index;
        if (offset > cursor) {
          children.push({ type: "text", value: node.value.slice(cursor, offset) });
        }

        const tag = match[1] === "~" ? "sub" : "sup";
        children.push({
          type: tag === "sub" ? "subscript" : "superscript",
          data: { hName: tag },
          children: [{ type: "text", value: match[2] }],
        });
        cursor = offset + match[0].length;
      }

      if (cursor === 0) return;
      if (cursor < node.value.length) {
        children.push({ type: "text", value: node.value.slice(cursor) });
      }

      parent.children.splice(index, 1, ...children as typeof parent.children);
    });
  };
}
