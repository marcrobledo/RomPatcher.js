# RomM Extension for RomPatcher.js

Integrates RomPatcher.js with a [RomM](https://github.com/zurdi15/romm) ROM management server.

## File Structure

```
src/extensions/
├── registry.js          # Generic client registry (supports multiple backends)
├── integration.js       # Generic integration framework (QR, ZIP, search, UI wiring)
└── romm/
    ├── settings.js      # Minimal settings UI (always loaded)
    ├── client.js        # RomM API client (download, upload, search, hash lookup)
    └── plugin.js        # Wires RomM client to integration framework hooks
```

## How It Works

1. **settings.js** is always loaded. It provides the RomM configuration UI in the Settings dialog.
2. If RomM is configured (URL + API Key saved in localStorage), settings.js dynamically loads the full extension.
3. **registry.js** → **client.js** → **integration.js** → **plugin.js** are loaded in order.
4. The extension hooks into RomPatcherWeb to:
   - Auto-fetch ROMs from RomM when a patch file with hashes is loaded
   - Search RomM by hash or name
   - Upload patched ROMs back to RomM
   - Download patched ROMs locally (with optional ZIP compression)

## Features

- **Auto-lookup**: When a patch file containing CRC32/MD5/SHA1 hashes is loaded, the extension automatically searches RomM for a matching ROM and loads it.
- **Manual search**: Search by hash (CRC32, MD5, SHA1) or by name.
- **Download**: Download patched ROM locally, with optional ZIP compression.
- **Upload**: Upload patched ROM to RomM server, with automatic library rescan.
- **Custom output name**: Specify a custom filename for the output ROM.
- **Export/Import**: Export RomM settings as JSON or QR code for easy transfer to other devices.

## Configuration

1. Open RomPatcher.js in a browser
2. Click Settings → enter your RomM server URL and API key
3. Click "Save & Reload"
4. The extension will automatically load and enable RomM integration

## API Key

Generate an API key in RomM:
- Go to RomM → Settings → Users → your user → Client Tokens
- Create a new token with appropriate scopes (roms.read, roms.write, platforms.read)