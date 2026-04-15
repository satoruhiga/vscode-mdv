import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkWikiLink from "@flowershow/remark-wiki-link";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import remarkSupersub from "remark-supersub";
import remarkDeflist from "remark-deflist";
import { remarkMark } from "remark-mark-highlight";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import { remarkFrontmatterExtract } from "./remarkFrontmatterExtract";
import { rehypeFrontmatterTable } from "./rehypeFrontmatterTable";
import { rehypeImagePath } from "./rehypeImagePath";
import { rehypeSourceLine } from "./rehypeSourceLine";
import { rehypeVideoEmbed } from "./rehypeVideoEmbed";

// Theme (light only)
import githubLight from "shiki/themes/github-light.mjs";

// Languages (fine-grained bundle)
import javascript from "shiki/langs/javascript.mjs";
import typescript from "shiki/langs/typescript.mjs";
import python from "shiki/langs/python.mjs";
import rust from "shiki/langs/rust.mjs";
import go from "shiki/langs/go.mjs";
import java from "shiki/langs/java.mjs";
import c from "shiki/langs/c.mjs";
import cpp from "shiki/langs/cpp.mjs";
import html from "shiki/langs/html.mjs";
import css from "shiki/langs/css.mjs";
import json from "shiki/langs/json.mjs";
import yaml from "shiki/langs/yaml.mjs";
import toml from "shiki/langs/toml.mjs";
import sql from "shiki/langs/sql.mjs";
import markdown from "shiki/langs/markdown.mjs";
import shellscript from "shiki/langs/shellscript.mjs";
import svelte from "shiki/langs/svelte.mjs";
import mermaid from "shiki/langs/mermaid.mjs";

export type ProcessResult =
  | { ok: true; html: string }
  | { ok: false; error: string };

export interface ProcessOptions {
  /** Absolute path to the Markdown file being processed */
  basePath?: string;
  /** Absolute path to the root folder (workspace root) */
  rootPath?: string;
  /** Function to convert absolute file path to Webview URI */
  convertFileSrc?: (path: string) => string;
}

let highlighterPromise: ReturnType<typeof createHighlighterCore> | null = null;

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [githubLight],
      langs: [
        javascript, typescript, python, rust, go, java, c, cpp,
        html, css, json, yaml, toml, sql, markdown, shellscript,
        svelte, mermaid,
      ],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return highlighterPromise;
}

export async function processMarkdown(
  markdownContent: string,
  options: ProcessOptions = {}
): Promise<ProcessResult> {
  try {
    const highlighter = await getHighlighter();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const remarkPlugins: any[] = [
      remarkParse,
      remarkFrontmatter,
      remarkFrontmatterExtract,
      [
        remarkWikiLink,
        {
          format: "regular",
          urlResolver: ({
            filePath,
            heading,
            isEmbed,
          }: {
            filePath: string;
            isEmbed: boolean;
            heading: string;
          }) => {
            if (isEmbed) {
              return filePath;
            }
            const path = filePath.endsWith(".md") ? filePath : `${filePath}.md`;
            return heading ? `${path}#${heading}` : path;
          },
          className: "wiki-link",
          aliasDivider: "|",
        },
      ],
      remarkGfm,
      remarkDeflist,
      remarkBreaks,
      remarkSupersub,
      remarkMark,
      remarkMath,
    ];

    let processor = unified();
    for (const plugin of remarkPlugins) {
      if (Array.isArray(plugin)) {
        processor = processor.use(plugin[0], plugin[1]);
      } else {
        processor = processor.use(plugin);
      }
    }

    const result = await processor
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeFrontmatterTable)
      .use(rehypeImagePath, {
        basePath: options.basePath,
        rootPath: options.rootPath,
        convertFileSrc: options.convertFileSrc,
      })
      .use(rehypeVideoEmbed)
      .use(rehypeSourceLine)
      .use(rehypeKatex)
      .use(rehypeShikiFromHighlighter, highlighter as any, {
        theme: "github-light",
        addLanguageClass: true,
      })
      .use(rehypeStringify, { allowDangerousHtml: true })
      .process(markdownContent);

    return { ok: true, html: String(result) };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error processing markdown";
    return { ok: false, error: message };
  }
}
