import type { Root, Element, ElementContent } from "hast";
import type { VFile } from "vfile";
import { parse as parseYaml } from "yaml";

export function rehypeFrontmatterTable() {
  return (tree: Root, file: VFile) => {
    const frontmatterRaw = file.data.frontmatterRaw as string | undefined;

    if (!frontmatterRaw) {
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = parseYaml(frontmatterRaw);
    } catch {
      const errorElement = createErrorElement(frontmatterRaw);
      tree.children.unshift(errorElement);
      return;
    }

    if (!parsed || typeof parsed !== "object") {
      return;
    }

    const tableElement = createTableElement(parsed);
    tree.children.unshift(tableElement);
  };
}

function createErrorElement(rawYaml: string): Element {
  return {
    type: "element",
    tagName: "div",
    properties: { className: ["frontmatter-error"] },
    children: [
      {
        type: "element",
        tagName: "div",
        properties: { className: ["frontmatter-error-title"] },
        children: [{ type: "text", value: "Invalid YAML frontmatter" }],
      },
      {
        type: "element",
        tagName: "pre",
        properties: { className: ["frontmatter-error-content"] },
        children: [{ type: "text", value: rawYaml }],
      },
    ],
  };
}

function createTableElement(data: Record<string, unknown>): Element {
  const rows: Element[] = Object.entries(data).map(([key, value]) => {
    return {
      type: "element",
      tagName: "tr",
      properties: {},
      children: [
        {
          type: "element",
          tagName: "th",
          properties: { scope: "row" },
          children: [{ type: "text", value: key }],
        },
        {
          type: "element",
          tagName: "td",
          properties: {},
          children: formatValue(value),
        },
      ],
    };
  });

  return {
    type: "element",
    tagName: "table",
    properties: { className: ["frontmatter-table"] },
    children: [
      {
        type: "element",
        tagName: "tbody",
        properties: {},
        children: rows,
      },
    ],
  };
}

function formatValue(value: unknown): ElementContent[] {
  if (value === null || value === undefined) {
    return [
      {
        type: "element",
        tagName: "span",
        properties: { className: ["frontmatter-null"] },
        children: [{ type: "text", value: "null" }],
      },
    ];
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => formatPrimitive(item));
    return [{ type: "text", value: items.join(", ") }];
  }

  if (typeof value === "object") {
    return [
      {
        type: "element",
        tagName: "code",
        properties: { className: ["frontmatter-json"] },
        children: [{ type: "text", value: JSON.stringify(value, null, 2) }],
      },
    ];
  }

  return [{ type: "text", value: formatPrimitive(value) }];
}

function formatPrimitive(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}
