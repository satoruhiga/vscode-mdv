import type { Root, Element } from "hast";
import { visit } from "unist-util-visit";

export interface RehypeImagePathOptions {
  /** Absolute path to the Markdown file being processed */
  basePath?: string;
  /** Absolute path to the root folder */
  rootPath?: string;
  /** Function to convert absolute file path to displayable URL */
  convertFileSrc?: (path: string) => string;
}

function isExternalUrl(src: string): boolean {
  return /^(https?:|data:|blob:|asset:|\/\/)/i.test(src);
}

function isRootRelative(src: string): boolean {
  return src.startsWith("/") && !src.startsWith("//");
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function getDirectory(filePath: string): string {
  const normalized = normalizePath(filePath);
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash >= 0 ? normalized.substring(0, lastSlash) : "";
}

function resolvePath(relativePath: string, baseDir: string): string {
  const normalized = normalizePath(relativePath);
  const base = normalizePath(baseDir);
  const isAbsolutePosixPath = base.startsWith("/");

  let path = normalized;
  if (path.startsWith("./")) {
    path = path.substring(2);
  }

  const baseSegments = base.split("/").filter((s) => s);
  const pathSegments = path.split("/").filter((s) => s);

  const result = [...baseSegments];
  for (const segment of pathSegments) {
    if (segment === "..") {
      result.pop();
    } else if (segment !== ".") {
      result.push(segment);
    }
  }

  const resolved = result.join("/");
  return isAbsolutePosixPath ? `/${resolved}` : resolved;
}

export function rehypeImagePath(options: RehypeImagePathOptions = {}) {
  const { basePath, rootPath, convertFileSrc } = options;

  return (tree: Root) => {
    if (!basePath) {
      return;
    }

    const baseDir = getDirectory(basePath);

    visit(tree, "element", (node: Element) => {
      const pathProperties = getPathProperties(node.tagName);
      if (!pathProperties.length) {
        return;
      }

      for (const propertyName of pathProperties) {
        const src = node.properties?.[propertyName];
        if (typeof src !== "string" || !src) {
          continue;
        }

        if (isExternalUrl(src)) {
          continue;
        }

        let absolutePath: string;

        if (isRootRelative(src)) {
          if (rootPath) {
            absolutePath = normalizePath(rootPath) + src;
          } else {
            continue;
          }
        } else {
          absolutePath = resolvePath(src, baseDir);
        }

        node.properties = node.properties || {};
        node.properties["dataOriginalPath"] = absolutePath;

        if (convertFileSrc) {
          node.properties[propertyName] = convertFileSrc(absolutePath);
        } else {
          node.properties[propertyName] = absolutePath;
        }
      }
    });
  };
}

function getPathProperties(tagName: string): string[] {
  if (tagName === "img") {
    return ["src"];
  }
  if (tagName === "video") {
    return ["src", "poster"];
  }
  if (tagName === "source") {
    return ["src"];
  }
  return [];
}
