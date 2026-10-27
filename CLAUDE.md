# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Install: `npm install` (deps: chalk@4, commander — CommonJS only, don't upgrade chalk to 5+)
- Tests: `npm test` (runs `node test.js`, a flat script with no test runner — no per-test filter)
  - Real-ROM tests read `_test_files/roms/` and `_test_files/patches/` (gitignored, must be supplied manually). Without them those cases print "skipping" and only the synthetic round-trip tests run (HashCalculator, IPS/BPS/PPF/UPS/APS/RUP/EBP create+apply, BPS large-value export).
  - To run a single case, comment out the others or use `node -e` against the modules directly.
- CLI: `node index.js patch <rom> <patch> [-h0|-h1] [-f] [-v]`, `node index.js create <original> <modified> -f <format>`
- Docker: `cd docker && docker-compose up --build` (patches everything in `docker/input`, outputs to `docker/output`)
- No lint or build step. Browser code is plain `<script>` tags, no bundler, no ES modules.

## Architecture

**Two layers sharing one core.** `rom-patcher-js/` is the patching engine used by both the browser and Node. `webapp/webapp.js` and `rom-patcher-js/RomPatcher.webapp.js` are the browser UI layer on top; `index.html` is the hosted site, `index_template.html` is the embed example from the README. `index.js` is the Node CLI (commander), a thin wrapper over the same core.

**Module pattern (important for loading order).** Everything is global, not imported. Each format file defines a constructor (e.g. `BPS`) with static `MAGIC`, `fromFile(binFile)`, `buildFromRoms(orig, mod)`, and prototype `apply(romFile)`, `export()`, and optionally `validateSource()`. Each file ends with a `module.exports` guard so Node can load it too. In Node, `rom-patcher-js/RomPatcher.js` pulls the format modules in with bare assignments (`BPS = require(...)`) at the bottom of the file, which is what makes the globals exist there.

**Patch lifecycle** (all in `rom-patcher-js/RomPatcher.js`):
1. `parsePatchFile` sniffs the 4–8 byte magic and dispatches to a format's `fromFile`.
2. `applyPatch(romFile, patch, options)` wraps `patch.apply()` with the shared logic: optional header strip/re-add (SNES copier 512-byte, iNES, LNX, FDS — see `HEADERS_INFO`), `requireValidation` via `patch.validateSource`, checksum fixing (GB, Mega Drive), and output naming.
3. `createPatch(original, modified, format)` dispatches to a format's `buildFromRoms`, then `patch.export()` produces the file.

**Browser execution.** Heavy work runs in Web Workers: `RomPatcher.webworker.apply.js`, `.create.js`, `.crc.js`. Each calls `importScripts` with its own list of modules, so a new format must be added to the worker that needs it as well as to the main-thread list. ZIP inputs are handled by the vendored `modules/zip.js`.

**Adding a new patch format** touches several places that are not linked by imports:
- `rom-patcher-js/modules/RomPatcher.format.<name>.js`
- `RomPatcher.js`: `parsePatchFile` dispatch, `createPatch` dispatch if creation is supported, and the Node `require` block at the bottom
- `RomPatcher.webapp.js`: `SCRIPT_DEPENDENCIES` and `FILTER_PATCHES` regex
- `RomPatcher.webworker.apply.js` (and `create.js` if creating)
- `index.html`: the `accept=` list on the patch file input
- `_cache_service_worker.js`: `PRECACHE_URLS` and bump `PRECACHE_VERSION` (the offline cache won't refresh otherwise)
- `docker/entrypoint.sh` extension filters, and the README format list

Recent format commits (e.g. xdelta3 support) followed this checklist.

**Service worker.** `_cache_service_worker.js` precaches the app for offline use, with paths under `/RomPatcher.js/`. Any change to a precached file needs a `PRECACHE_VERSION` bump.

**Tests and fixtures.** `test.js` checks each format by round-tripping a synthetic ROM and, when fixtures are present, by applying real community patches and comparing CRC32 of the output. The expected CRC values in `TEST_PATCHES` are the source of truth for real-ROM behavior.
