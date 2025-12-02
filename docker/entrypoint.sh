#!/bin/bash
set -e

# Directories inside container
INPUT_DIR="/app/input"
OUTPUT_DIR="/app/output"
TEMP_PATCHES="/tmp/patches"
RP_DIR="/app"

mkdir -p "$TEMP_PATCHES" "$OUTPUT_DIR"

# Detect ROM (first non-patch file)
ROM_FILE=$(find "$INPUT_DIR" -maxdepth 1 -type f ! -iname "*.zip" ! -iname "*.bps" ! -iname "*.ips" ! -iname "*.ups" ! -iname "*.ppf" ! -iname "*.xdelta" | head -n 1)

if [ -z "$ROM_FILE" ]; then
    echo "ERROR: No ROM found in $INPUT_DIR"
    exit 1
fi

ROM_NAME=$(basename "$ROM_FILE")
ROM_EXT="${ROM_NAME##*.}"
echo "ROM detected: $ROM_NAME"

# Extract ZIP patches if not already extracted
for z in "$INPUT_DIR"/*.zip; do
    [ -e "$z" ] || continue
    ZIP_BASENAME=$(basename "$z" .zip)
    TARGET_DIR="$TEMP_PATCHES/$ZIP_BASENAME"

    if [ -d "$TARGET_DIR" ] && [ "$(ls -A "$TARGET_DIR")" ]; then
        echo "ZIP patch already extracted: $z"
    else
        echo "Extracting ZIP patch: $z → $TARGET_DIR"
        mkdir -p "$TARGET_DIR"
        unzip -o "$z" -d "$TARGET_DIR"
    fi
done

# Copy individual patch files (bps, ips, ups, ppf, xdelta) into TEMP_PATCHES
find "$INPUT_DIR" -maxdepth 1 -type f \( -iname "*.bps" -o -iname "*.ips" -o -iname "*.ups" -o -iname "*.ppf" -o -iname "*.xdelta" \) \
    -exec cp {} "$TEMP_PATCHES" \;

# Apply each patch
for patch in "$TEMP_PATCHES"/*/* "$TEMP_PATCHES"/*; do
    [ -e "$patch" ] || continue
    # skip directories without patches
    [ -f "$patch" ] || continue

    PATCH_BASE=$(basename "$patch")
    PATCH_NAME="${PATCH_BASE%.*}"
    OUTPUT_FILE="$OUTPUT_DIR/$PATCH_NAME.$ROM_EXT"

    echo "Applying patch: $PATCH_BASE → $OUTPUT_FILE"
    node "$RP_DIR/index.js" patch "$ROM_FILE" "$patch" "$OUTPUT_FILE"
done

echo "All patches applied. Output files are in $OUTPUT_DIR"
