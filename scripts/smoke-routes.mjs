import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const ssrMapPath = path.join(root, "server", "ssr-asset-hashes.json");

const requiredPages = [
  "index.html",
  "nightlife.html",
  "nightlife-map.html",
  "club.html",
  "portal.html",
  "account.html",
];

async function assertExists(filePath) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`Missing required file: ${path.relative(root, filePath)}`);
  }
}

async function main() {
  for (const page of requiredPages) {
    await assertExists(path.join(distDir, page));
  }

  const raw = await readFile(ssrMapPath, "utf8");
  const map = JSON.parse(raw);
  const keys = ["nightlife", "clubDetail"];
  for (const key of keys) {
    const entry = map?.[key];
    if (!entry?.js) throw new Error(`SSR map missing js entry for "${key}"`);
    if (!Array.isArray(entry.css) || !entry.css.length) {
      throw new Error(`SSR map missing css entries for "${key}"`);
    }

    await assertExists(path.join(distDir, entry.js.replace(/^\//, "")));
    for (const css of entry.css) {
      await assertExists(path.join(distDir, css.replace(/^\//, "")));
    }
  }

  console.log("smoke:routes passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
