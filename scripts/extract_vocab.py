# SEEDSED — extract_vocab.py
# Purpose: read the word list embedded in a Vosk grammar FST (OpenFst symbol table) so tests can
#          prove every practice word is one the recognizer knows.
# Boundaries: read-only on the FST; writes one plain-text word list.
import struct
import sys

TABLE_NAME = b"words.txt"


def read_words(fst_bytes):
    end = fst_bytes.index(TABLE_NAME) + len(TABLE_NAME)
    _available, size = struct.unpack_from("<qq", fst_bytes, end)
    pos = end + 16
    words = []
    for _ in range(size):
        (length,) = struct.unpack_from("<i", fst_bytes, pos)
        pos += 4
        words.append(fst_bytes[pos:pos + length].decode("utf-8", "replace"))
        pos += length + 8  # skip the int64 symbol id
    return words


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    with open(src, "rb") as f:
        words = read_words(f.read())
    if len(words) < 1000:
        sys.exit(f"Vocabulary looks wrong: only {len(words)} entries")
    with open(dst, "w", encoding="utf-8") as f:
        f.write("\n".join(words) + "\n")
    print(f"{len(words)} words -> {dst}")
