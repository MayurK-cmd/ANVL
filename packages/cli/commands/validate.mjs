import { loadConfig, toManifest, validateConfig } from "@anvil/sdk";
import * as ui from "../ui.mjs";

/** Shared by `anvil validate` and `anvil deploy` — deploy never skips this. */
export async function checkConfig({ cwd, verbose }) {
  const { config, path } = await loadConfig(cwd);
  const { ok, errors, warnings } = validateConfig(config);

  for (const warning of warnings) ui.warn(warning);
  if (!ok) {
    ui.errorBlock(`invalid ${path}`, errors);
    return { ok: false };
  }

  const manifest = toManifest(config, { cwd });
  if (verbose) console.log(JSON.stringify(manifest, null, 2));
  return { ok: true, config, path, manifest };
}

export async function runValidate({ cwd, verbose }) {
  const result = await checkConfig({ cwd, verbose });
  if (!result.ok) return 1;

  const { manifest, path } = result;
  ui.ok(`${path} is valid`);
  ui.blank();
  ui.kv([
    ["id", manifest.id, "ember"],
    ["type", manifest.type],
    ["price", `${manifest.price} ANVL  (${manifest.amount} base units)`, "brass"],
    ["endpoint", manifest.endpoint],
    ["params", manifest.params.map((p) => p.name).join(", ") || "none"],
    ...(manifest.envKeys.length
      ? [["env keys", `${manifest.envKeys.join(", ")}  (names only, no values)`]]
      : []),
  ]);
  ui.blank();
  return 0;
}
