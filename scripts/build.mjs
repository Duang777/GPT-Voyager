import { build, context } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const distDir = resolve(root, "dist");
const watchMode = process.argv.includes("--watch");

const sharedConfig = {
  bundle: true,
  minify: false,
  sourcemap: true,
  target: "chrome120",
  logLevel: "info"
};

const buildConfigs = [
  {
    ...sharedConfig,
    entryPoints: ["src/content/index.tsx"],
    outfile: "dist/content.js",
    format: "iife"
  },
  {
    ...sharedConfig,
    entryPoints: ["src/background/index.ts"],
    outfile: "dist/background.js",
    format: "iife"
  }
];

async function copyStaticFiles() {
  await mkdir(distDir, { recursive: true });
  await cp(resolve(root, "src", "manifest.json"), resolve(distDir, "manifest.json"));
}

async function cleanDist() {
  await rm(distDir, { recursive: true, force: true });
}

async function runBuild() {
  await cleanDist();
  await copyStaticFiles();

  if (watchMode) {
    const contexts = await Promise.all(buildConfigs.map((cfg) => context(cfg)));
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log("[watch] Extension build is watching for changes...");
    return;
  }

  await Promise.all(buildConfigs.map((cfg) => build(cfg)));
  console.log("[build] Extension bundle is ready in dist/");
}

runBuild().catch((error) => {
  console.error("[build] Failed:", error);
  process.exit(1);
});

