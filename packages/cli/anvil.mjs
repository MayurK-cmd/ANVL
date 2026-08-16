#!/usr/bin/env node
/**
 * anvil — scaffold, validate and upload agents to the Anvil Store.
 *
 * Argument parsing is node:util's parseArgs. A CLI with four commands does not
 * need a framework.
 */

import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runInit } from "./commands/init.mjs";
import { runValidate } from "./commands/validate.mjs";
import { runDeploy } from "./commands/deploy.mjs";
import * as ui from "./ui.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(here, "package.json"), "utf8"));

function help() {
  ui.banner({ version, force: true });

  ui.heading("Usage");
  ui.kv([
    ["anvil init <name>", "Scaffold a new agent project"],
    ["anvil validate", "Check anvil.config.ts without uploading"],
    ["anvil deploy -k <key>", "Validate, build the manifest, upload to the Store"],
    ["anvil wrap <command>", "Package a learned Webcmd command (not built yet)"],
  ]);

  ui.heading("Options");
  ui.kv([
    ["-k, --key <key>", "Store deploy key. Falls back to $ANVIL_DEPLOY_KEY"],
    ["    --url <url>", "Store URL. Default $ANVIL_STORE_URL or http://localhost:3000"],
    ["    --dry-run", "Print the manifest that would be uploaded, upload nothing"],
    ["-v, --verbose", "Show the full manifest and HTTP details"],
    ["-h, --help", "Show this help"],
    ["    --version", "Print the version"],
  ]);

  ui.nextSteps([
    "anvil init scholar-search",
    "cd scholar-search && anvil validate",
    "anvil deploy -k dev-key --url http://localhost:3000",
  ], "examples");
}

const options = {
  key: { type: "string", short: "k" },
  url: { type: "string" },
  "dry-run": { type: "boolean", default: false },
  verbose: { type: "boolean", short: "v", default: false },
  help: { type: "boolean", short: "h", default: false },
  version: { type: "boolean", default: false },
};

async function main(argv) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options, allowPositionals: true });
  } catch (error) {
    help();
    ui.errorBlock(error.message);
    return 2;
  }

  const { values, positionals } = parsed;
  const [command, ...rest] = positionals;

  if (values.version) {
    console.log(version);
    return 0;
  }
  if (values.help || !command) {
    help();
    return command ? 0 : 1;
  }

  ui.banner({ version });

  switch (command) {
    case "init":
      return runInit({ name: rest[0], verbose: values.verbose });
    case "validate":
      return runValidate({ cwd: process.cwd(), verbose: values.verbose });
    case "deploy":
      return runDeploy({
        cwd: process.cwd(),
        key: values.key ?? process.env.ANVIL_DEPLOY_KEY,
        url: values.url ?? process.env.ANVIL_STORE_URL ?? "http://localhost:3000",
        dryRun: values["dry-run"],
        verbose: values.verbose,
      });
    case "wrap":
      ui.errorBlock("anvil wrap is not built yet", [
        "It needs the Webcmd runtime and @anvil/webcmd-adapter (PRD phase 2).",
        'Write the agent by hand: anvil init <name>, then set agentType: "browser".',
      ]);
      return 1;
    default:
      help();
      ui.errorBlock(`unknown command "${command}"`);
      return 2;
  }
}

const code = await main(process.argv.slice(2)).catch((error) => {
  ui.errorBlock(error?.message ?? String(error));
  return 1;
});
process.exit(code);
