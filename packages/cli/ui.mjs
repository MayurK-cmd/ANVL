/**
 * Terminal styling for the anvil CLI.
 *
 * No chalk, no figlet, no boxen — a banner is a string constant and a colour is
 * four bytes of escape code. Everything degrades to plain text automatically.
 *
 * Rules that keep the CLI scriptable:
 *  - colour only when stdout is a TTY and NO_COLOR is unset
 *  - the banner only when stdout is a TTY, so `anvil validate | grep` stays clean
 *  - machine-readable payloads (JSON, --version) go to stdout ALONE; all
 *    decoration goes to stderr
 */

const NO_COLOR = process.env.NO_COLOR !== undefined;
const FORCE = process.env.FORCE_COLOR !== undefined && process.env.FORCE_COLOR !== "0";

export const isTTY = Boolean(process.stdout.isTTY);
export const colorEnabled = FORCE || (isTTY && !NO_COLOR && process.env.TERM !== "dumb");

/** Brand palette from docs/brand.md, as truecolor escapes. */
const rgb = (r, g, b) => (text) =>
  colorEnabled ? `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m` : String(text);

export const ember = rgb(224, 106, 43);
export const brass = rgb(201, 163, 90);
export const steel = rgb(212, 196, 168);
export const ash = rgb(154, 139, 120);
export const bone = rgb(232, 223, 208);
export const danger = rgb(224, 84, 74);
export const good = rgb(126, 176, 110);

export const bold = (text) => (colorEnabled ? `\x1b[1m${text}\x1b[22m` : String(text));
export const dim = (text) => (colorEnabled ? `\x1b[2m${text}\x1b[22m` : String(text));

/**
 * "ANVIL" in block capitals. Hand-laid rather than generated at runtime — the
 * word never changes, so a font library would be a dependency to print a
 * constant.
 */
const WORDMARK = [
  " █████╗ ███╗   ██╗██╗   ██╗██╗██╗     ",
  "██╔══██╗████╗  ██║██║   ██║██║██║     ",
  "███████║██╔██╗ ██║██║   ██║██║██║     ",
  "██╔══██║██║╚██╗██║╚██╗ ██╔╝██║██║     ",
  "██║  ██║██║ ╚████║ ╚████╔╝ ██║███████╗",
  "╚═╝  ╚═╝╚═╝  ╚═══╝  ╚═══╝  ╚═╝╚══════╝",
];

/** Heat gradient down the wordmark: cooling brass at the top, ember at the base. */
const HEAT = [
  [201, 163, 90],
  [214, 140, 66],
  [224, 122, 52],
  [224, 106, 43],
  [214, 92, 40],
  [166, 74, 36],
];

let bannerShown = false;

/**
 * Print the wordmark once per process, to stderr so piped stdout stays clean.
 * `force` is for `anvil --help`, where the banner is the point.
 */
export function banner({ version, force = false } = {}) {
  if (bannerShown) return;
  if (!isTTY && !force) return;
  bannerShown = true;

  const lines = WORDMARK.map((line, index) => {
    const [r, g, b] = HEAT[index];
    return colorEnabled ? `\x1b[38;2;${r};${g};${b}m${line}\x1b[39m` : line;
  });

  process.stderr.write("\n");
  for (const line of lines) process.stderr.write(`  ${line}\n`);
  process.stderr.write(
    `  ${ash("⚒  agents are assets · forged on Monad Testnet")}${
      version ? dim(`   v${version}`) : ""
    }\n\n`,
  );
}

const SYM = {
  ok: "✔",
  fail: "✖",
  warn: "▲",
  step: "▸",
  dot: "·",
};

/** Decoration → stderr. Keeps stdout a clean data channel. */
const out = (text) => process.stderr.write(`${text}\n`);

export const say = out;
export const ok = (text) => out(`  ${good(SYM.ok)} ${bone(text)}`);
export const fail = (text) => out(`  ${danger(SYM.fail)} ${bone(text)}`);
export const warn = (text) => out(`  ${brass(SYM.warn)} ${steel(text)}`);
export const step = (text) => out(`  ${ember(SYM.step)} ${steel(text)}`);
export const note = (text) => out(`    ${ash(text)}`);
export const blank = () => out("");

export function heading(text) {
  out(`\n  ${bold(bone(text))}`);
  out(`  ${dim("─".repeat(Math.max(text.length, 8)))}`);
}

/** Aligned key/value block. */
export function kv(pairs, indent = "    ") {
  const width = Math.max(...pairs.map(([key]) => key.length));
  for (const [key, value, accent] of pairs) {
    const painted = accent === "ember" ? ember(value) : accent === "brass" ? brass(value) : bone(value);
    out(`${indent}${ash(key.padEnd(width))}  ${painted}`);
  }
}

/** File tree with box-drawing branches. */
export function tree(root, files) {
  out(`  ${brass(root)}`);
  files.forEach((file, index) => {
    const last = index === files.length - 1;
    out(`  ${dim(last ? "└─" : "├─")} ${steel(file)}`);
  });
}

export function bullets(lines, symbol = SYM.dot) {
  for (const line of lines) out(`    ${dim(symbol)} ${steel(line)}`);
}

/** A boxed callout for the one thing the user should do next. */
export function nextSteps(lines, label = "next") {
  out(`\n  ${dim(label)}`);
  for (const line of lines) out(`    ${ember("$")} ${bone(line)}`);
  out("");
}

export function errorBlock(title, details = []) {
  blank();
  fail(title);
  for (const detail of details) out(`      ${danger("-")} ${steel(detail)}`);
  blank();
}
