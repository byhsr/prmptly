import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

// The updater compares the running binary's baked-in version against latest.json,
// so these four files have to move together. Bump only package.json and the app
// keeps reporting itself as current — with no error anywhere.
const root = process.cwd()
const files = {
  pkg: join(root, "package.json"),
  conf: join(root, "src-tauri", "tauri.conf.json"),
  cargo: join(root, "src-tauri", "Cargo.toml"),
  lock: join(root, "src-tauri", "Cargo.lock"),
}

const read = (path) => readFileSync(path, "utf8")
const eolOf = (text) => (text.includes("\r\n") ? "\r\n" : "\n")
const rel = (path) => path.slice(root.length + 1)

function bump(version, kind) {
  const [major, minor, patch] = version.split(".").map(Number)
  if (kind === "major") return `${major + 1}.0.0`
  if (kind === "minor") return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

// Re-serializing flattens CRLF to LF, so match the original EOL and keep the
// trailing newline exactly as the file had it.
function patchJson(source, version) {
  const json = JSON.parse(source)
  json.version = version
  const eol = eolOf(source)
  const body = JSON.stringify(json, null, 2).replace(/\n/g, eol)
  return source.endsWith("\n") ? body + eol : body
}

const arg = process.argv[2]
if (!arg || !/^(\d+\.\d+\.\d+|major|minor|patch)$/.test(arg)) {
  console.error("usage: npm run release:bump -- <major|minor|patch|x.y.z>")
  process.exit(1)
}

const current = JSON.parse(read(files.pkg)).version
if (!/^\d+\.\d+\.\d+$/.test(current)) {
  console.error(`package.json version "${current}" is not x.y.z`)
  process.exit(1)
}

const next = /^\d+\.\d+\.\d+$/.test(arg) ? arg : bump(current, arg)
if (next === current) {
  console.error(`already on ${current}`)
  process.exit(1)
}

// The crate name differs from the product name (pr0mptly vs prmptly), so read it
// from the manifest rather than hardcoding a spelling that can drift.
const crate = /\[package\][\s\S]*?\r?\nname = "([^"]+)"/.exec(read(files.cargo))?.[1]
if (!crate) {
  console.error("aborted: could not read the crate name from src-tauri/Cargo.toml")
  process.exit(1)
}

const edits = [
  [files.pkg, (s) => patchJson(s, next)],
  [files.conf, (s) => patchJson(s, next)],
  [files.cargo, (s) => s.replace(/(\[package\][\s\S]*?\r?\nversion = ")[^"]+(")/, `$1${next}$2`)],
  [files.lock, (s) => s.replace(new RegExp(`(\\[\\[package\\]\\]\\r?\\nname = "${crate}"\\r?\\nversion = ")[^"]+(")`), `$1${next}$2`)],
]

// Plan every write before touching disk, so a drifted file aborts the whole run
// instead of leaving the versions half-updated.
const planned = edits.map(([path, transform]) => {
  const after = transform(read(path))
  if (after === read(path)) {
    console.error(`aborted: nothing to change in ${rel(path)} — versions are out of sync`)
    process.exit(1)
  }
  return [path, after]
})

for (const [path, after] of planned) {
  writeFileSync(path, after)
  console.log(`  ${rel(path)} -> ${next}`)
}

console.log(`\n${current} -> ${next}`)
console.log(`git commit -am "release v${next}" && git tag v${next} && git push origin main --tags`)
