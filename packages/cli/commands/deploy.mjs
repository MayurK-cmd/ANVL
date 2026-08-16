import { checkConfig } from "./validate.mjs";
import * as ui from "../ui.mjs";

/**
 * Upload the manifest to the Store.
 *
 * The manifest is built from anvil.config.ts by @anvil/sdk, which reads env KEY
 * NAMES only — no secret ever leaves the machine through this command.
 */
export async function runDeploy({ cwd, key, url, dryRun, verbose }) {
  const result = await checkConfig({ cwd, verbose });
  if (!result.ok) return 1;

  const { manifest } = result;

  if (dryRun) {
    console.log(JSON.stringify(manifest, null, 2));
    ui.blank();
    ui.warn(`dry run — nothing uploaded. Target would be ${url}/api/agents`);
    return 0;
  }

  if (!key) {
    ui.errorBlock("anvil deploy needs a key", [
      "anvil deploy -k <key>",
      "or set $ANVIL_DEPLOY_KEY",
    ]);
    return 2;
  }

  const target = `${url.replace(/\/+$/, "")}/api/agents`;
  ui.step(`hammering ${manifest.id} → ${target}`);

  let response;
  try {
    response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-anvil-key": key },
      body: JSON.stringify(manifest),
    });
  } catch (error) {
    ui.errorBlock(`could not reach the Store at ${target}`, [
      error?.message ?? String(error),
      "Is it running? Pass --url if it lives somewhere else.",
    ]);
    return 1;
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    ui.errorBlock(`deploy failed (${response.status})`, [
      ...(body?.error ? [body.error] : []),
      ...(body?.details ?? []),
      ...(response.status === 401
        ? [`The Store rejected this key. Create one at ${url}/keys, or check $ANVIL_DEPLOY_KEY.`]
        : []),
      ...(response.status === 503 ? [`Create a deploy key at ${url}/keys.`] : []),
    ]);
    return 1;
  }

  ui.ok(`${manifest.id} is on the Store`);
  ui.blank();
  ui.kv([
    ["listing", body.updated ? "updated existing" : "new", "brass"],
    ["store page", `${url}/store/${manifest.id}`, "ember"],
    ["endpoint", manifest.endpoint],
  ]);
  ui.blank();
  if (verbose) console.log(JSON.stringify(body, null, 2));
  return 0;
}
