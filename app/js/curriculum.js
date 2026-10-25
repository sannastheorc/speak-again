// SEEDSED — curriculum.js
// Purpose: WHAT to practise. Ordered stages from voice warm-up to phrases, each item with the words
//          the recognizer should accept and a plain-language mouth-placement tip.
// Boundaries: pure data plus lookups. Does not judge attempts (assess.js), track mastery (progress.js)
//             or choose order (session.js). Every word in `accept` must exist in the model vocabulary
//             (enforced by tests/curriculum.test.mjs).

// Placement tips, keyed by the sound that matters most in an item.
export const TIPS = {
  ah: "Drop your jaw and open wide. Tongue rests low and relaxed.",
  ee: "Smile wide. The middle of your tongue lifts high and forward.",
  oo: "Round your lips small, like sipping through a straw.",
  oh: "Round your lips into an O shape.",
  ay: "Start half open, then slide into a smile.",
  eye: "Open wide, then slide into a smile.",
  m: "Close your lips and hum, then open: mmm-ah.",
  b: "Lips together, build a little air, then pop them open with your voice on.",
  p: "Lips together, then pop them open with a puff of air.",
  w: "Round your lips like a kiss, then open.",
  t: "The tip of your tongue taps the bump just behind your top teeth.",
  d: "The tip of your tongue taps the bump behind your top teeth, voice on.",
  n: "Tongue tip up behind your top teeth and hum through your nose.",
  l: "Tongue tip up behind your top teeth. Let your voice flow around the sides.",
  k: "The back of your tongue lifts to the roof of your mouth, then lets go.",
  g: "The back of your tongue lifts and lets go, voice on.",
  h: "Open your mouth and breathe out, like a sigh.",
  f: "Rest your top teeth lightly on your bottom lip and blow.",
  v: "Top teeth on your bottom lip, blow with your voice on. It should buzz.",
  s: "Teeth close together, tongue tip just behind them. Hiss like a snake.",
  z: "Like a hiss, but with your voice on, like a bee buzzing.",
  sh: "Push your lips forward and say shh, like quieting a baby.",
  ch: "Lips forward. Tongue presses up, then releases: ch.",
  j: "Lips forward. Tongue presses up, then releases with voice on.",
  th: "Let your tongue tip peek out between your teeth and blow gently.",
  r: "Lips slightly rounded. Your tongue tip lifts but doesn't touch anything.",
  y: "Lift the middle of your tongue high, as if starting to say yes.",
  blend: "Go slowly. Say each sound, then slide them together.",
  beats: "Tap the table once for each beat as you say it.",
  phrase: "Say it slowly, one word at a time, then try it smoothly."
};

const it = (text, accept, tip, extra = {}) => ({
  id: text.toLowerCase().replace(/[^a-z]+/g, "-").replace(/(^-|-$)/g, ""),
  text,
  say: extra.say || text,
  accept,
  tip,
  ...extra
});

export const STAGES = [
  {
    id: "voice", title: "Warm up your voice", kind: "voice",
    goal: "Turn your voice on and hold a steady sound. The bar fills while I hear you.",
    items: [
      it("Ahh", [], "ah", { id: "hold-ah-2", say: "ahhhhh", holdSec: 2 }),
      it("Mmm", [], "m", { id: "hold-mm-2", say: "mmmmmm", holdSec: 2 }),
      it("Ooo", [], "oo", { id: "hold-oo-2", say: "oooooo", holdSec: 2 }),
      it("Eee", [], "ee", { id: "hold-ee-2", say: "eeeeee", holdSec: 2 }),
      it("Ahh", [], "ah", { id: "hold-ah-4", say: "ahhhhhhhhh", holdSec: 4 })
    ]
  },
  {
    id: "alphabet", title: "The alphabet", kind: "speech",
    goal: "Say each letter's name. They're grouped by where your mouth works.",
    items: [
      it("A", ["a", "ay"], "ay", { group: "Open vowels" }),
      it("E", ["e", "ee"], "ee", { group: "Open vowels" }),
      it("I", ["i", "eye", "aye"], "eye", { group: "Open vowels" }),
      it("O", ["o", "oh", "owe"], "oh", { group: "Open vowels" }),
      it("U", ["u", "you", "yew"], "oo", { group: "Open vowels" }),
      it("B", ["b", "bee", "be"], "b", { group: "Lips" }),
      it("P", ["p", "pee", "pea"], "p", { group: "Lips" }),
      it("M", ["m", "em"], "m", { group: "Lips" }),
      it("W", ["w", "double you"], "w", { group: "Lips" }),
      it("F", ["f", "eff"], "f", { group: "Lips and teeth" }),
      it("V", ["v", "vee"], "v", { group: "Lips and teeth" }),
      it("D", ["d", "dee"], "d", { group: "Tongue tip" }),
      it("T", ["t", "tee", "tea"], "t", { group: "Tongue tip" }),
      it("N", ["n", "en"], "n", { group: "Tongue tip" }),
      it("L", ["l", "el"], "l", { group: "Tongue tip" }),
      it("S", ["s", "ess"], "s", { group: "Tongue tip" }),
      it("Z", ["z", "zee", "zed"], "z", { group: "Tongue tip" }),
      it("C", ["c", "see", "sea"], "s", { group: "Tongue tip" }),
      it("K", ["k", "kay"], "k", { group: "Back of tongue" }),
      it("G", ["g", "gee"], "j", { group: "Back of tongue" }),
      it("Q", ["q", "queue", "cue"], "k", { group: "Back of tongue" }),
      it("J", ["j", "jay"], "j", { group: "Tongue middle" }),
      it("Y", ["y", "why"], "w", { group: "Tongue middle" }),
      it("H", ["h", "age"], "h", { group: "Tongue middle" }),
      it("R", ["r", "are"], "r", { group: "Tongue middle" }),
      it("X", ["x", "ex"], "k", { group: "Tongue middle" })
    ]
  },
  {
    id: "lips", title: "Lip sounds", kind: "speech",
    goal: "Short sounds made with your lips. These need the least tongue work.",
    items: [
      it("me", ["me"], "m"), it("my", ["my"], "m"), it("moo", ["moo"], "m"), it("may", ["may"], "m"),
      it("bee", ["bee", "be", "b"], "b"), it("buy", ["buy", "by", "bye"], "b"), it("boo", ["boo"], "b"), it("bay", ["bay"], "b"),
      it("pie", ["pie", "pi"], "p"), it("pay", ["pay"], "p"), it("paw", ["paw", "pa"], "p"), it("why", ["why", "y"], "w")
    ]
  },
  {
    id: "tip", title: "Tongue tip", kind: "speech",
    goal: "The tip of your tongue taps just behind your top teeth.",
    items: [
      it("tea", ["tea", "tee", "t"], "t"), it("two", ["two", "to", "too"], "t"), it("toe", ["toe", "tow"], "t"), it("tie", ["tie", "thai"], "t"),
      it("day", ["day"], "d"), it("do", ["do", "due", "dew"], "d"), it("dough", ["dough", "doe"], "d"),
      it("no", ["no", "know"], "n"), it("knee", ["knee", "nee"], "n"), it("new", ["new", "knew"], "n"),
      it("low", ["low", "lo"], "l"), it("lay", ["lay"], "l")
    ]
  },
  {
    id: "back", title: "Back of the tongue", kind: "speech",
    goal: "The back of your tongue lifts to the roof of your mouth, then lets go.",
    items: [
      it("key", ["key", "k"], "k"), it("cow", ["cow"], "k"), it("car", ["car"], "k"), it("coat", ["coat"], "k"),
      it("go", ["go"], "g"), it("guy", ["guy"], "g"), it("goo", ["goo"], "g"), it("gum", ["gum"], "g")
    ]
  },
  {
    id: "short", title: "Short words", kind: "speech",
    goal: "Everyday one-beat words that start and end with a sound.",
    items: [
      it("cup", ["cup"], "k"), it("mom", ["mom", "mum"], "m"), it("dad", ["dad"], "d"), it("bed", ["bed"], "b"),
      it("top", ["top"], "t"), it("dog", ["dog"], "d"), it("cat", ["cat"], "k"), it("bus", ["bus"], "b"),
      it("hat", ["hat"], "h"), it("pen", ["pen"], "p"), it("boat", ["boat"], "b"), it("home", ["home"], "h")
    ]
  },
  {
    id: "beats", title: "Two-beat words", kind: "speech",
    goal: "Words with two beats. Tap the table for each beat.",
    items: [
      it("water", ["water"], "beats"), it("hello", ["hello"], "beats"), it("coffee", ["coffee"], "beats"), it("baby", ["baby"], "beats"),
      it("table", ["table"], "beats"), it("window", ["window"], "beats"), it("yellow", ["yellow"], "beats"), it("happy", ["happy"], "beats"),
      it("pillow", ["pillow"], "beats"), it("money", ["money"], "beats"), it("doctor", ["doctor"], "beats"), it("button", ["button"], "beats")
    ]
  },
  {
    id: "harder", title: "Harder sounds", kind: "speech",
    goal: "Sounds that need more exact tongue and lip shapes: s, sh, f, v, th, r, ch.",
    items: [
      it("sun", ["sun", "son"], "s"), it("see", ["see", "sea", "c"], "s"), it("shoe", ["shoe"], "sh"), it("she", ["she"], "sh"),
      it("fish", ["fish"], "f"), it("five", ["five"], "f"), it("very", ["very"], "v"), it("red", ["red", "read"], "r"),
      it("run", ["run"], "r"), it("three", ["three"], "th"), it("thank", ["thank"], "th"), it("yes", ["yes"], "y"),
      it("zoo", ["zoo"], "z"), it("chair", ["chair"], "ch"), it("jump", ["jump"], "j")
    ]
  },
  {
    id: "blends", title: "Sound blends", kind: "speech",
    goal: "Two sounds pushed together at the start. Go slowly.",
    items: [
      it("stop", ["stop"], "blend"), it("spoon", ["spoon"], "blend"), it("snow", ["snow"], "blend"), it("green", ["green"], "blend"),
      it("blue", ["blue", "blew"], "blend"), it("please", ["please"], "blend"), it("bread", ["bread", "bred"], "blend"), it("train", ["train"], "blend"),
      it("glass", ["glass"], "blend"), it("sleep", ["sleep"], "blend"), it("frog", ["frog"], "blend"), it("clock", ["clock"], "blend")
    ]
  },
  {
    id: "long", title: "Long words", kind: "speech",
    goal: "Three or more beats. Say it in beats first, then smoothly.",
    items: [
      it("banana", ["banana"], "beats", { say: "ba-na-na" }), it("tomato", ["tomato"], "beats"), it("potato", ["potato"], "beats"),
      it("telephone", ["telephone"], "beats"), it("computer", ["computer"], "beats"), it("hospital", ["hospital"], "beats"),
      it("elephant", ["elephant"], "beats"), it("umbrella", ["umbrella"], "beats"), it("family", ["family"], "beats"),
      it("medicine", ["medicine"], "beats")
    ]
  },
  {
    id: "phrases", title: "Everyday phrases", kind: "speech",
    goal: "Short things you say every day. Slowly first, then smoothly.",
    items: [
      it("thank you", ["thank you"], "phrase"), it("good morning", ["good morning"], "phrase"), it("good night", ["good night"], "phrase"),
      it("I love you", ["i love you"], "phrase"), it("how are you", ["how are you"], "phrase"), it("I am fine", ["i am fine", "i'm fine"], "phrase"),
      it("see you later", ["see you later"], "phrase"), it("I need help", ["i need help"], "phrase"), it("a glass of water", ["a glass of water", "glass of water"], "phrase"),
      it("yes please", ["yes please"], "phrase"), it("no thank you", ["no thank you"], "phrase")
    ]
  }
];

export function getStage(id) {
  return STAGES.find(s => s.id === id) || null;
}

export function getItem(stageId, itemId) {
  const stage = getStage(stageId);
  return stage ? stage.items.find(i => i.id === itemId) || null : null;
}

// Words the recognizer listens for on one item: its own accepted forms plus its neighbours in the
// same group/stage, so a near miss ("pea" for "bee") is heard as such instead of forced to the target.
export function listenPhrases(stage, item, maxNeighbours = 8) {
  const at = stage.items.indexOf(item);
  const neighbours = stage.items
    .map((i, n) => ({ i, d: Math.abs(n - at) }))
    .filter(({ i }) => i.id !== item.id && (!item.group || i.group === item.group))
    .sort((a, b) => a.d - b.d)
    .slice(0, maxNeighbours)
    .map(({ i }) => i)
    .flatMap(i => i.accept.slice(0, 2));
  return [...new Set([...item.accept, ...neighbours])];
}
