#!/usr/bin/env bash
# SEEDSED — fetch-model.sh
# Purpose: download the Vosk small US-English model (Apache-2.0), verify its checksum,
#          repack it as the .tar.gz that vosk-browser loads, and extract its vocabulary (for tests and
#          for the app's "My words" check, as app/data/vocab.txt).
# Boundaries: writes only app/model/, app/data/ and build/; never edits source. Model weights stay out of tracked source.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME="vosk-model-small-en-us-0.15"
URL="https://alphacephei.com/vosk/models/${NAME}.zip"
SHA256="30f26242c4eb449f948e42cb302dd7a686cb29a3423a8367f99ff41780942498"
OUT="$ROOT/app/model/model.tar.gz"
WORK="$ROOT/build/model-work"

if [[ -f "$OUT" && -f "$ROOT/build/vocab.txt" ]]; then
  echo "Model already present: $OUT"
  mkdir -p "$ROOT/app/data" && grep -v '^[#<!]' "$ROOT/build/vocab.txt" > "$ROOT/app/data/vocab.txt"
  exit 0
fi

rm -rf "$WORK"; mkdir -p "$WORK" "$ROOT/app/model"
echo "Downloading $URL"
curl -fL --retry 3 -o "$WORK/model.zip" "$URL"
echo "$SHA256  $WORK/model.zip" | sha256sum -c -

(cd "$WORK" && unzip -q model.zip)
tar -C "$WORK" -czf "$OUT.tmp" "$NAME"
mv "$OUT.tmp" "$OUT"
python3 -I "$ROOT/scripts/extract_vocab.py" "$WORK/$NAME/graph/Gr.fst" "$ROOT/build/vocab.txt"
rm -rf "$WORK"
mkdir -p "$ROOT/app/data" && grep -v '^[#<!]' "$ROOT/build/vocab.txt" > "$ROOT/app/data/vocab.txt"
ls -l "$OUT" "$ROOT/app/data/vocab.txt"
