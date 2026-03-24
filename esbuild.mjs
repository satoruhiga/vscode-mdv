import * as esbuild from "esbuild";
import { cpSync, mkdirSync } from "fs";

const isWatch = process.argv.includes("--watch");

// Copy static assets (KaTeX CSS/fonts, Mermaid JS) to media/
function copyAssets() {
  mkdirSync("media/katex", { recursive: true });
  cpSync("node_modules/katex/dist/katex.min.css", "media/katex/katex.min.css");
  cpSync("node_modules/katex/dist/fonts", "media/katex/fonts", { recursive: true });
  cpSync("node_modules/mermaid/dist/mermaid.min.js", "media/mermaid.min.js");
}

/** @type {esbuild.BuildOptions} */
const buildOptions = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "out/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  sourcemap: true,
  target: "node22",
};

copyAssets();

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build(buildOptions);
  console.log("Build complete.");
}
