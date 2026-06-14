# OELT Course File — `.oeltcourse` format

**Status:** Normative. Version `0.1`.
**Depends on:** [`manifest-v0.md`](./manifest-v0.md) (course tree layout).

The key words MUST, MUST NOT, SHOULD, and MAY are interpreted as in RFC 2119.

---

## 1. Purpose

`.oeltcourse` is the single-file exchange format for an OELT course: a standard course tree
(course.json + assets) zipped into one portable file. It is the unit of transfer between authoring
tools, LLM clients, and CI pipelines, and is the input format the MCP server and oeltkit-cloud
workspace tools expect.

The format does not replace the directory tree — authors still work in directories. It wraps the
tree for transport and is always round-trippable: `export → import → identical tree`.

## 2. Container format

A `.oeltcourse` file is a ZIP archive (DEFLATE compression recommended, Store permitted).

### 2.1 Required layout

```
course.json          ← manifest (manifest-v0.md), at the archive root
pages/               ← at least the page files referenced by course.json
```

All paths in the archive are relative POSIX paths from the archive root. Additional asset
directories (`media/`, `scenarios/`, `theme/`, etc.) appear at their natural locations relative to
`course.json`.

### 2.2 Forbidden entries

- **Absolute paths** — entries whose name starts with `/` or matches `[A-Za-z]:\\` MUST NOT appear.
- **Directory-traversal paths** — entries that, after `path.resolve(targetDir, entryName)`,
  resolve to a location outside the extraction target MUST NOT appear.
- **Executable system files** — entries whose normalized path matches `/^(\.\.\/|\/)/` after
  stripping the leading path separator MUST be rejected.

Consumers MUST validate every entry name before extraction (§5).

## 3. Version semantics

The embedded `course.json` carries the `oelt` field that governs the manifest version (see
`manifest-v0.md §8`). The `.oeltcourse` container itself carries **no separate version field** —
the manifest version is sufficient.

### 3.1 Forward-compatibility rule

- A newer toolkit version MUST always open `.oeltcourse` files whose embedded manifest has a
  MAJOR version the toolkit implements (i.e., `0.x` forever-opens older `0.y`).
- Opening a file whose embedded `course.json` has a MAJOR version higher than the toolkit
  supports MUST fail with a clear error that names the required version:

  ```
  oelt: this .oeltcourse requires toolkit v2.0 or later — please upgrade oelt
  ```

- The consumer checks the embedded manifest's `oelt` field, not the `.oeltcourse` filename or
  any other metadata.

## 4. Size guidance

| Size | Outcome |
|------|---------|
| ≤ 50 MB | Normal |
| > 50 MB | Tool SHOULD emit a warning advising the author to reduce asset sizes |
| > 200 MB | Tool MUST refuse to create the file with a clear error |

These limits apply to the compressed archive size. During import, there is no limit on
uncompressed size but tools SHOULD warn if the extracted tree exceeds 500 MB.

## 5. Zip-slip safety (normative)

Consumers MUST perform the following check on every entry before extraction:

```
resolved = path.resolve(targetDir, entryName)
safe     = resolved.startsWith(path.resolve(targetDir) + path.sep)
          || resolved === path.resolve(targetDir)
```

If `safe` is false, extraction MUST be aborted and the whole import MUST fail with a clear
error naming the offending entry. Do not extract partial archives.

## 6. CLI commands

### 6.1 `oelt export <dir> [--out <file.oeltcourse>]`

Packages the course tree at `<dir>` into a `.oeltcourse` file.

- Default output: `<parentDir>/<dir-basename>.oeltcourse`.
- Validates the course before export (same rules as `oelt validate`). Refuses to export if any
  `error`-level finding is present.
- Emits a size warning if the output exceeds 50 MB.
- Fails with a clear error if the output would exceed 200 MB.

### 6.2 `oelt import <file.oeltcourse> <dir>`

Extracts the archive to `<dir>`.

- Fails if `<dir>` already exists and is non-empty (prevents silent overwrites).
- Applies zip-slip safety on every entry (§5).
- Validates the embedded manifest version (§3.1). Fails immediately on MAJOR mismatch.
- Creates `<dir>` if it does not exist.

### 6.3 `.oeltcourse` as input to existing commands

`oelt validate`, `oelt package`, and `oelt preview` MAY accept a `.oeltcourse` file in place
of a directory. The tool extracts the file to a temporary directory, runs the command, then
removes the temporary directory. The temp dir is transparent to the user; only the command's
normal output is shown.

## 7. Authoring tool contract

Tools that produce or consume `.oeltcourse` files (MCP server, oeltkit-cloud) MUST follow §5.
They SHOULD call `oelt import` rather than reimplementing extraction, so zip-slip fixes
propagate automatically.
