import type { Root, Yaml } from "mdast";
import type { VFile } from "vfile";

/**
 * Remark plugin to extract frontmatter data and store it in vfile.data.
 * This allows the frontmatter to be accessed by rehype plugins later.
 */
export function remarkFrontmatterExtract() {
  return (tree: Root, file: VFile) => {
    const yamlNode = tree.children.find(
      (node): node is Yaml => node.type === "yaml"
    );

    if (yamlNode && yamlNode.value) {
      file.data.frontmatterRaw = yamlNode.value;
    }
  };
}
