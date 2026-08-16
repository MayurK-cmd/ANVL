import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { slugify } from "@anvil/sdk";
import {
  agentFile,
  configFile,
  envFile,
  gitignoreFile,
  packageFile,
  readmeFile,
} from "../templates.mjs";
import * as ui from "../ui.mjs";

export function runInit({ name }) {
  if (!name) {
    ui.errorBlock("anvil init needs a name", ["anvil init scholar-search"]);
    return 2;
  }

  const id = slugify(name);
  if (!id) {
    ui.errorBlock(`"${name}" has no usable characters for an agent id`);
    return 2;
  }

  const dir = resolve(process.cwd(), id);
  if (existsSync(dir)) {
    ui.errorBlock(`${dir} already exists`, ["Pick another name, or delete it first."]);
    return 1;
  }

  const files = {
    "anvil.config.ts": configFile({ name, id }),
    "src/index.mjs": agentFile({ name }),
    "README.md": readmeFile({ name, id }),
    ".env": envFile(),
    ".gitignore": gitignoreFile,
    "package.json": packageFile({ id }),
  };

  mkdirSync(join(dir, "src"), { recursive: true });
  for (const [file, contents] of Object.entries(files)) {
    writeFileSync(join(dir, file), contents, "utf8");
  }

  ui.heading(`forged ${id}`);
  ui.blank();
  ui.tree(`${id}/`, Object.keys(files));
  ui.blank();
  ui.note("set devAddress and price in anvil.config.ts, write run() in src/index.mjs");
  ui.nextSteps([`cd ${id}`, "npm start", "anvil validate", "anvil deploy -k <key>"]);
  return 0;
}
