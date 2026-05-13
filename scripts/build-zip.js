const { spawnSync } = require("node:child_process");
const { mkdirSync, readFileSync, rmSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const distDir = join(root, "dist");
const zipName = `${packageJson.name}-v${packageJson.version}.zip`;
const zipPath = join(distDir, zipName);

const files = [
  "manifest.json",
  "assets",
  "content.css",
  "content-android.css",
  "docs/css-generator.html",
  "options.html",
  "options.css",
  "README.md"
];

mkdirSync(distDir, { recursive: true });
rmSync(zipPath, { force: true });

const result = spawnSync("zip", ["-r", zipPath, ...files], {
  cwd: root,
  stdio: "inherit"
});

if (result.error?.code === "ENOENT") {
  console.error("The `zip` command is required. Install it and rerun `npm run build`.");
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log(`Created ${zipPath}`);
