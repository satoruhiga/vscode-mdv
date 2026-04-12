import type { Root, Element } from "hast";
import { visit } from "unist-util-visit";

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|ogv)(\?.*)?$/i;

function isVideoSrc(src: string): boolean {
  return VIDEO_EXTENSIONS.test(src);
}

export function rehypeVideoEmbed() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "img") {
        return;
      }

      const src = node.properties?.src;
      if (typeof src !== "string" || !isVideoSrc(src)) {
        return;
      }

      node.tagName = "video";
      node.properties = {
        ...node.properties,
        controls: true,
        loop: true,
        muted: true,
        playsinline: true,
      };
      delete node.properties.alt;
      node.children = [];
    });
  };
}
