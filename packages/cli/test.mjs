import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const CLI = join(dirname(fileURLToPath(import.meta.url)), "anvil.mjs");

let work;
before(() => {
  work = mkdtempSync(join(tmpdir(), "anvil-cli-"));
});
after(() => {
  rmSync(work, { recursive: true, force: true });
});

const anvil = (args, cwd) =>
  run(process.execPath, [CLI, ...args], { cwd }).catch((error) => error);

describe("anvil init", () => {
  it("scaffolds a project whose config loads with nothing installed", async () => {
    await anvil(["init", "Scholar Search"], work);
    const dir = join(work, "scholar-search");
    const config = readFileSync(join(dir, "anvil.config.ts"), "utf8");

    // A type-only import is erased by Node, so no node_modules is needed.
    assert.match(config, /import type \{ AnvilConfig \}/);
    assert.match(readFileSync(join(dir, "src/index.mjs"), "utf8"), /createServer/);

    const { code } = await anvil(["validate"], dir);
    // Fails only because the scaffold ships the zero address on purpose.
    assert.equal(code, 1);
  });

  it("refuses to overwrite an existing directory", async () => {
    const result = await anvil(["init", "Scholar Search"], work);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /already exists/);
  });

  it("needs a name", async () => {
    const result = await anvil(["init"], work);
    assert.equal(result.code, 2);
  });
});

describe("anvil validate / deploy", () => {
  let dir;

  before(async () => {
    await anvil(["init", "Priced Agent"], work);
    dir = join(work, "priced-agent");
    const config = readFileSync(join(dir, "anvil.config.ts"), "utf8").replace(
      "0x0000000000000000000000000000000000000000",
      "0x1a2b3C4D5e6f708192A3B4c5d6e7F8091A2b9f4c",
    );
    writeFileSync(join(dir, "anvil.config.ts"), config);
    writeFileSync(join(dir, ".env"), "OPENAI_API_KEY=sk-secret-value\n");
  });

  it("validates a completed config", async () => {
    // Human-readable output is decoration, so it goes to stderr; stdout stays
    // a clean data channel for JSON.
    const { stdout, stderr } = await anvil(["validate"], dir);
    assert.match(stderr, /is valid/);
    assert.match(stderr, /10000000000000000 base units/);
    assert.equal(stdout, "");
  });

  it("builds a manifest carrying env key names but no values", async () => {
    const { stdout } = await anvil(["deploy", "--dry-run"], dir);
    const manifest = JSON.parse(stdout.slice(0, stdout.lastIndexOf("}") + 1));
    assert.deepEqual(manifest.envKeys, ["OPENAI_API_KEY"]);
    assert.equal(stdout.includes("sk-secret-value"), false);
    assert.equal(manifest.id, "priced-agent");
    assert.equal(manifest.endpoint, "http://localhost:8000/send");
  });

  it("refuses to deploy without a key", async () => {
    const result = await anvil(["deploy"], dir);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /needs a key/);
  });

  it("reports an unreachable store instead of hanging", async () => {
    const result = await anvil(
      ["deploy", "-k", "x", "--url", "http://127.0.0.1:1"],
      dir,
    );
    assert.equal(result.code, 1);
    assert.match(result.stderr, /could not reach the Store/);
  });

  it("errors outside a project", async () => {
    const result = await anvil(["validate"], work);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /No anvil config found/);
  });
});

describe("anvil argv", () => {
  it("prints a version", async () => {
    const { stdout } = await anvil(["--version"], work);
    assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
  });

  it("rejects an unknown command", async () => {
    const result = await anvil(["frobnicate"], work);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /unknown command/);
  });

  it("says wrap is not built rather than pretending", async () => {
    const result = await anvil(["wrap", "thing"], work);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /not built yet/);
  });
});
