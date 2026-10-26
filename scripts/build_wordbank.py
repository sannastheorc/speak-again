# SEEDSED — build_wordbank.py
# Purpose: generate app/js/wordbank.js, the large practice word bank, from four sources:
#   - CMU Pronouncing Dictionary (BSD-style licence): how each word is pronounced;
#   - NGSL-Spoken 1.2 and NGSL 1.2 (Browne, Culligan & Phillips, CC BY-SA 4.0): everyday English
#     words, spoken list first, by frequency. The generated word bank is shared under CC BY-SA 4.0 too;
#   - the Vosk model vocabulary (build/vocab.txt): which words the listener knows.
# Words are sorted by their sounds (where the mouth works, start or end of word), contrast pairs are
# found automatically, and spellings that sound identical become accepted alternatives.
# Boundaries: build-time only; writes one generated JS module. Hand-written stages live in curriculum.js.
# Usage: python3 -I scripts/build_wordbank.py <cmudict.dict> <NGSL_12_stats.csv> <NGSL-Spoken_12_stats.csv> build/vocab.txt app/js/wordbank.js
import csv
import json
import re
import sys
from collections import defaultdict

SOURCES = {
    "cmudict": "cmusphinx/cmudict@74790861f652b15e4ac49015a90074ad62a27690 sha256 81917843c7f44ce2b094ac63873c2c7a4cf802040792c455ba3ca406891c3d22",
    "ngsl": "newgeneralservicelist.com NGSL_12_stats.csv sha256 2098bab8955a120a9766c6282a51d7d578c6cb0a7d946600d2ffb73ba25a0b44 (CC BY-SA 4.0)",
    "ngsl_spoken": "newgeneralservicelist.com NGSL-Spoken_12_stats.csv sha256 07708940c50a07cac4f507fd1e87bdd50081d7b87713a66a99beb3c8c4d11ac8 (CC BY-SA 4.0)",
}

# ARPAbet consonants -> the app's sound keys (curriculum TIPS keys).
SOUND = {"M": "m", "B": "b", "P": "p", "W": "w", "F": "f", "V": "v", "TH": "th", "DH": "th",
         "T": "t", "D": "d", "N": "n", "L": "l", "S": "s", "Z": "z", "SH": "sh", "ZH": "sh",
         "CH": "ch", "JH": "j", "K": "k", "G": "g", "NG": "n", "HH": "h", "Y": "y", "R": "r"}

# Words never offered: emotionally heavy for someone recovering from a stroke, unkind, adult,
# brand/tech jargon, abbreviations and common first names.
BLOCK = set("""
die died dies dead death deaths dying kill killed killing kills sick sickness pain painful hurt hurts injury
stroke strokes weak weakness cancer disease diseases disabled disability disorder mute dumb stupid fool crazy
idiot ugly fat hate hated hates war wars gun guns bomb bombs blood crime crimes prison jail drug drugs drunk
sex sexy sexual nude naked adult adults porn gay lesbian fail failed failure fails wrong lose loss lost losing
poor broke broken alone cry crying grief funeral grave hospital doctor doctors nurse therapy patient patients
damage damaged danger dangerous fear afraid worse worst bad sad pity shame sorry problem problems trouble
google yahoo ebay msn aol amazon apple microsoft dell sony nokia ipod iphone dvd pdf html xml php usb faq
http www com net org rss mp3 gps url api cnet espn nba nfl mlb ncaa uk usa eu ca tx fl ny nj pa
john david james mike paul mary peter mark steve chris scott tom jim bob joe bill jack ben dan tony
kevin jason brian eric ryan adam alex ann anne jane sarah lisa linda susan nancy karen amy kim
bush clinton obama jesus christ god lord bible church allah islam muslim jewish
unclear laughter cough inaudible crosstalk mm hmm um uh er erm ah oh yeah gonna wanna gotta
terrorist terror attack attacks enemy weapon weapons shoot shot violence violent
""".split())

STOP = set("""
a an the of and or but if to in on at by for from with as is are was were be been being am do does did
have has had will would shall should can could may might must not no nor so than that this these those
it its he she they them their there here his her him we us our you your i me my mine what which who whom
whose when where why how all any each every some such only own same too very just also then into onto
upon about above below over under again further once off out up down
""".split())

VOWELS = {"AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW"}

SOUND_STAGES = [
    ("lipwords", "Lip sounds in words", "M, B, P and W at the start and end of everyday words.", ["m", "b", "p", "w"]),
    ("teethwords", "Lips and teeth: F and V", "Top teeth rest on your bottom lip.", ["f", "v"]),
    ("tipwords", "Tongue tip in words", "T, D, N and L: the tongue tip taps behind your top teeth.", ["t", "d", "n", "l"]),
    ("backwords", "Back of tongue in words", "K and G: the back of your tongue lifts and lets go.", ["k", "g"]),
    ("hisswords", "S and Z", "Teeth close together, tongue tip just behind them.", ["s", "z"]),
    ("shwords", "Sh, Ch and J", "Lips forward for these sounds.", ["sh", "ch", "j"]),
    ("thwords", "Th sounds", "Tongue tip peeks out between your teeth.", ["th"]),
    ("rwords", "R sounds", "Tongue tip lifts but doesn't touch.", ["r"]),
    ("hywords", "H and Y", "H is a breath. Y starts with your tongue high.", ["h", "y"]),
]
PER_SOUND_START, PER_SOUND_END = 12, 7

PAIRS = [("b", "p"), ("d", "t"), ("g", "k"), ("v", "f"), ("z", "s"), ("m", "n"), ("b", "d"), ("p", "t"),
         ("t", "k"), ("d", "g"), ("l", "r"), ("s", "sh"), ("w", "r"), ("f", "th"), ("ch", "sh"), ("m", "b")]
PER_PAIR = 7


def load_cmu(path):
    prons = defaultdict(list)
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.split("#")[0].strip()
            if not line:
                continue
            word, *phones = line.split()
            base = re.sub(r"\(\d+\)$", "", word)
            prons[base].append(tuple(re.sub(r"\d", "", p) for p in phones))
    return prons


def load_ngsl(path):
    with open(path, encoding="utf-8") as f:
        rows = list(csv.reader(f))[1:]
    rows = [r for r in rows if len(r) > 1 and r[1].strip().isdigit()]  # a few rows have no rank (#N/A)
    return [r[0].strip().lower() for r in sorted(rows, key=lambda r: int(r[1]))]


def main(cmu_path, ngsl_path, spoken_path, vocab_path, out_path):
    prons = load_cmu(cmu_path)
    vocab = set(open(vocab_path, encoding="utf-8").read().split())
    ranked = []
    for w in load_ngsl(spoken_path) + load_ngsl(ngsl_path):  # everyday spoken words first
        if w not in ranked:
            ranked.append(w)
    rank = {w: i for i, w in enumerate(ranked)}

    def usable(w):
        return (re.fullmatch(r"[a-z]{2,12}", w) and w in prons and w in vocab and w not in BLOCK
                and re.search(r"[aeiouy]", w) and len(prons[w][0]) >= 2)

    words = [w for w in ranked if usable(w)]
    by_pron = defaultdict(set)
    for w in ranked:
        if w in prons and w in vocab and w not in BLOCK:
            for p in prons[w]:
                by_pron[p].add(w)

    def info(w):
        p = prons[w][0]
        syl = sum(1 for x in p if x in VOWELS)
        first, last = p[0], p[-1]
        cluster = first not in VOWELS and len(p) > 1 and p[1] not in VOWELS
        homophones = sorted(by_pron[p] - {w}, key=lambda x: rank.get(x, 99999))[:3]
        return {"p": p, "syl": syl, "start": SOUND.get(first) if not cluster else None,
                "end": SOUND.get(last), "cluster": cluster, "accept": [w] + homophones}

    meta = {w: info(w) for w in words}
    used = set()

    def item(w, tip, **extra):
        used.add(w)
        m = meta[w]
        sounds = sorted({s for s in (m["start"], m["end"]) if s} | ({tip} if tip in SOUND.values() else set()))
        return {"id": w, "text": w, "accept": m["accept"], "tip": tip, "sounds": sounds, **extra}

    stages = []
    content = [w for w in words if w not in STOP]
    for sid, title, goal, sounds in SOUND_STAGES:
        items = []
        for s in sounds:
            starts = [w for w in content if meta[w]["syl"] == 1 and meta[w]["start"] == s and w not in used][:PER_SOUND_START]
            items += [item(w, s, group=f"{s.upper()} at the start") for w in starts]
            ends = [w for w in content if meta[w]["syl"] == 1 and meta[w]["end"] == s and meta[w]["start"] != s and w not in used][:PER_SOUND_END]
            items += [item(w, s, group=f"{s.upper()} at the end") for w in ends]
        stages.append({"id": sid, "title": title, "goal": goal, "kind": "speech", "items": items})

    # Contrast pairs: one-beat words identical except the first sound.
    pair_items, seen_pairs = [], set()
    one = [w for w in content if meta[w]["syl"] == 1 and meta[w]["start"]]
    rest_index = defaultdict(list)
    for w in one:
        rest_index[(meta[w]["start"], meta[w]["p"][1:])].append(w)
    for a, b in PAIRS:
        found = []
        for w in one:
            if meta[w]["start"] != a:
                continue
            partners = rest_index.get((b, meta[w]["p"][1:]), [])
            partners = [x for x in partners if x != w and (w, x) not in seen_pairs]
            if partners:
                x = partners[0]
                found.append((max(rank[w], rank[x]), w, x))
        for _, w, x in sorted(found)[:PER_PAIR]:
            seen_pairs.add((w, x)); seen_pairs.add((x, w))
            g = f"{a.upper()} / {b.upper()}"
            for word, s, partner in ((w, a, x), (x, b, w)):
                m = meta[word]
                pair_items.append({"id": f"{word}-vs-{partner}", "text": word, "accept": m["accept"], "tip": s,
                                   "sounds": [s], "group": g, "partner": partner})
    stages.append({"id": "pairs", "title": "Sound pairs", "kind": "speech",
                   "goal": "Two words that differ by one sound. Feel the difference in your mouth.", "items": pair_items})

    def pick(pred, n):
        return [w for w in content if w not in used and pred(meta[w])][:n]

    stages.append({"id": "twobeat", "title": "More two-beat words", "kind": "speech",
                   "goal": "Common words with two beats. Tap once for each beat.",
                   "items": [item(w, "beats") for w in pick(lambda m: m["syl"] == 2 and not m["cluster"], 160)]})
    stages.append({"id": "moreblends", "title": "More sound blends", "kind": "speech",
                   "goal": "Words that start with two sounds pushed together.",
                   "items": [item(w, "blend") for w in pick(lambda m: m["syl"] == 1 and m["cluster"], 100)]})
    stages.append({"id": "longer", "title": "Longer words", "kind": "speech",
                   "goal": "Three and four beats. Say it in beats, then smoothly.",
                   "items": [item(w, "beats") for w in pick(lambda m: m["syl"] in (3, 4), 120)]})

    total = sum(len(s["items"]) for s in stages)
    header = ("// SEEDSED — wordbank.js (GENERATED by scripts/build_wordbank.py — do not edit by hand)\n"
              "// Purpose: the large practice word bank: sound stages, contrast pairs, two-beat, blends, longer words.\n"
              f"// Sources: {json.dumps(SOURCES)}\n"
              f"// {total} items in {len(stages)} stages.\n")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(header + "export const WORDBANK_STAGES = " + json.dumps(stages, indent=0, separators=(",", ":")) + ";\n")
    for s in stages:
        print(f"{s['id']:12} {len(s['items']):4}  " + ", ".join(i["text"] for i in s["items"][:14]))
    print("total", total)


if __name__ == "__main__":
    main(*sys.argv[1:6])
