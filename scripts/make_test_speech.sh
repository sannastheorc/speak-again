#!/usr/bin/env bash
# SEEDSED — make_test_speech.sh
# Purpose: synthesize the clear test speech used by tests/browser/lines-check.html and next-check.html.
# Boundaries: writes only build/tts/ (not tracked). Needs ffmpeg built with flite. Synthetic speech
#             proves the plumbing; it says nothing about accuracy on an impaired voice.
set -euo pipefail
OUT="$(cd "$(dirname "$0")/.." && pwd)/build/tts"
mkdir -p "$OUT"
while IFS='|' read -r name text; do
  ffmpeg -nostdin -hide_banner -loglevel error -y -f lavfi -i "flite=text='$text':voice=slt" -ar 16000 -ac 1 -c:a pcm_s16le "$OUT/$name.wav"
done <<'LINES'
full|I would like a cup of coffee please
partial|I would like coffee please
start|I would like a cup
other|Can I have some water please
stan|good morning how are you today
pepper|pepper
coffee|coffee
tea|tea
fork|fork
sunday|Sunday
scriptfull|I would like a coffee please
scriptmost|I would like coffee please
scriptless|I would
talkfree|Well I had some eggs and toast this morning and then I sat outside for a while with the dog
LINES
