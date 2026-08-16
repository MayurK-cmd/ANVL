/**
 * Deploy keys — SERVER ONLY (touches the filesystem).
 *
 * `anvil deploy` authenticates with one of these in the `x-anvil-key` header.
 * Only the SHA-256 of a key is stored, so the file is not a secret and a leaked
 * copy cannot be replayed; the plaintext exists once, in the response to the
 * call that created it.
 *
 * ponytail: a JSON file under .anvil/ and no authentication on the create
 * endpoint — the same size as the agent registry next to it, and right for a
 * single-user localhost store. Anyone who can reach the Store can mint a key,
 * so gate POST /api/keys behind a wallet-signed admin address before this is
 * ever exposed beyond localhost.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), ".anvil");
const FILE = join(DIR, "keys.json");

export type StoredKey = {
  id: string;
  label: string;
  /** SHA-256 of the plaintext key, hex. */
  hash: string;
  /** Last four characters, so the UI can identify a key it will never see again. */
  tail: string;
  createdAt: string;
  lastUsedAt?: string;
};

/** What the UI is allowed to see: everything except the hash. */
export type PublicKey = Omit<StoredKey, "hash">;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function readAll(): StoredKey[] {
  if (!existsSync(FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8"));
    return Array.isArray(parsed) ? (parsed as StoredKey[]) : [];
  } catch {
    // A corrupt key file should not take the Store down; it locks deploys out
    // until it is fixed, which is the safe direction to fail.
    return [];
  }
}

function writeAll(list: StoredKey[]): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, `${JSON.stringify(list, null, 2)}\n`, "utf8");
}

/**
 * Allowlist rather than omit-the-hash: a secret field added to StoredKey later
 * cannot leak through this by default.
 */
function toPublic(entry: StoredKey): PublicKey {
  return {
    id: entry.id,
    label: entry.label,
    tail: entry.tail,
    createdAt: entry.createdAt,
    lastUsedAt: entry.lastUsedAt,
  };
}

export function listKeys(): PublicKey[] {
  return readAll()
    .map(toPublic)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Returns the plaintext key ONCE. It is not recoverable afterwards. */
export function createKey(label: string): { key: string; record: PublicKey } {
  const key = `anvil_${randomBytes(24).toString("hex")}`;
  const record: StoredKey = {
    id: randomBytes(6).toString("hex"),
    label: label.trim() || "Untitled key",
    hash: sha256(key),
    tail: key.slice(-4),
    createdAt: new Date().toISOString(),
  };
  writeAll([...readAll(), record]);
  return { key, record: toPublic(record) };
}

export function revokeKey(id: string): boolean {
  const list = readAll();
  const next = list.filter((entry) => entry.id !== id);
  if (next.length === list.length) return false;
  writeAll(next);
  return true;
}

/**
 * True if `provided` is either a stored key or the ANVIL_DEPLOY_KEY env var.
 * The env var stays supported so existing setups and CI keep working.
 */
export function verifyDeployKey(provided: string): boolean {
  if (!provided) return false;

  const envKey = process.env.ANVIL_DEPLOY_KEY;
  if (envKey && equals(provided, envKey)) return true;

  const hash = sha256(provided);
  const match = readAll().find((entry) => equals(entry.hash, hash));
  if (!match) return false;

  // Best effort: a failed write must not fail an otherwise valid deploy.
  try {
    writeAll(
      readAll().map((entry) =>
        entry.id === match.id ? { ...entry, lastUsedAt: new Date().toISOString() } : entry,
      ),
    );
  } catch {}

  return true;
}

/** Constant-time compare that does not leak length through early return. */
function equals(a: string, b: string): boolean {
  const left = Buffer.from(sha256(a), "hex");
  const right = Buffer.from(sha256(b), "hex");
  return timingSafeEqual(left, right);
}

/** True when at least one way of authenticating a deploy exists. */
export function deployEnabled(): boolean {
  return Boolean(process.env.ANVIL_DEPLOY_KEY) || readAll().length > 0;
}
