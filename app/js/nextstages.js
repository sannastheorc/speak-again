// SEEDSED — nextstages.js
// Purpose: the stages AFTER everyday sentences, moving from repeating toward his own speech:
//   counting (over-learned sequences) → finish (complete a familiar phrase) → naming (find the word
//   for a picture) → choices (answer with his own pick) → scripts (both sides of a real conversation)
//   → talk (free speech, no right answer).
// Each item's `mode` tells presentation.js how it is prompted. Evidence: docs/RESEARCH.md section 6.
// Boundaries: hand-written data only. Appended after the existing stages so nothing he has already
//             practised changes (enforced by tests/nextstages.test.mjs).

const slug = text => text.toLowerCase().replace(/[^a-z]+/g, "-").replace(/(^-|-$)/g, "");
const norm = text => text.toLowerCase().replace(/[^a-z' ]+/g, " ").replace(/\s+/g, " ").trim();

// ---- Numbers, days and months
const say = (text, accept, tip, group) => ({ id: slug(text), text, accept, tip, group });
const counting = [
  ...[["one", ["one", "won"], "w"], ["two", ["two", "to", "too"], "t"], ["three", ["three"], "th"], ["four", ["four", "for"], "f"],
    ["five", ["five"], "f"], ["six", ["six"], "s"], ["seven", ["seven"], "s"], ["eight", ["eight", "ate"], "ay"], ["nine", ["nine"], "n"],
    ["ten", ["ten"], "t"], ["eleven", ["eleven"], "beats"], ["twelve", ["twelve"], "blend"], ["thirteen", ["thirteen"], "th"],
    ["fifteen", ["fifteen"], "f"], ["twenty", ["twenty"], "blend"], ["thirty", ["thirty"], "th"], ["forty", ["forty"], "f"],
    ["fifty", ["fifty"], "f"], ["sixty", ["sixty"], "s"], ["seventy", ["seventy"], "beats"], ["eighty", ["eighty"], "ay"],
    ["ninety", ["ninety"], "n"], ["one hundred", ["one hundred", "a hundred"], "phrase"]]
    .map(([t, a, tip]) => say(t, a, tip, "Numbers")),
  ...[["Sunday", "s"], ["Monday", "m"], ["Tuesday", "t"], ["Wednesday", "w"], ["Thursday", "th"], ["Friday", "f"], ["Saturday", "s"]]
    .map(([t, tip]) => say(t, [t.toLowerCase()], tip, "Days of the week")),
  ...[["January", "j"], ["February", "f"], ["March", "m"], ["April", "ay"], ["May", "m"], ["June", "j"], ["July", "j"], ["August", "ah"],
    ["September", "s"], ["October", "oh"], ["November", "n"], ["December", "d"]]
    .map(([t, tip]) => say(t, [t.toLowerCase()], tip, "Months"))
];

// ---- Finish the phrase: show and say the start; he supplies the end.
const fin = (start, end, also = []) => ({ id: slug(`${start} ${end}`), mode: "finish", text: end, start, say: `${start} ${end}`, accept: [norm(end), ...also], tip: "find" });
const finish = [
  fin("Salt and", "pepper"), fin("Bread and", "butter"), fin("Knife and", "fork"), fin("Up and", "down"), fin("Black and", "white"),
  fin("Night and", "day"), fin("Hot and", "cold"), fin("Ladies and", "gentlemen"), fin("Rock and", "roll"), fin("Bacon and", "eggs"),
  fin("Fish and", "chips"), fin("Cup and", "saucer"), fin("Hide and", "seek"), fin("Mom and", "dad", ["pop"]), fin("Back and", "forth"),
  fin("Thunder and", "lightning"), fin("Peanut butter and", "jelly", ["jam"]), fin("Macaroni and", "cheese"), fin("Socks and", "shoes"),
  fin("A cup of", "coffee", ["tea"]), fin("A glass of", "water", ["milk", "wine"]), fin("A slice of", "bread", ["pizza", "cake"]),
  fin("Happy birthday to", "you"), fin("Once upon a", "time"), fin("Thank you very", "much"), fin("Ready, set,", "go"),
  fin("One, two,", "three"), fin("Twinkle, twinkle, little", "star"), fin("Better late than", "never"), fin("Home sweet", "home"),
  fin("Time to go to", "bed", ["sleep"]), fin("Brush your", "teeth", ["hair"]), fin("Wash your", "hands", ["face"]),
  fin("Open the", "door", ["window"]), fin("Turn on the", "light", ["tv"]), fin("Answer the", "phone", ["door"]),
  fin("Walk the", "dog"), fin("Mow the", "lawn", ["grass"]), fin("Drive the", "car", ["truck"]), fin("Read a", "book"),
  fin("In the morning I drink", "coffee", ["tea", "water", "juice"]), fin("At night I go to", "bed", ["sleep"]),
  fin("Monday, Tuesday,", "Wednesday"), fin("Spring, summer,", "fall", ["autumn"])
];

// ---- Name the picture: find the word, with a meaning hint before the first-letter hint.
const pic = (picture, text, hint, also = []) => ({ id: slug(text), mode: "name", text, picture, hint, say: text, accept: [norm(text), ...also], tip: "find" });
const naming = [
  pic("☕", "coffee", "A hot drink for the morning."), pic("🍎", "apple", "A crunchy fruit. It can be red or green."), pic("🔑", "key", "It opens a door."),
  pic("🐕", "dog", "A pet that barks.", ["puppy"]), pic("🐈", "cat", "A pet that purrs.", ["kitten", "kitty"]), pic("🍞", "bread", "You make toast with it.", ["loaf"]),
  pic("⌚", "watch", "It goes on your wrist and tells the time."), pic("🪑", "chair", "You sit on it at the table."), pic("🚗", "car", "You drive it on the road.", ["automobile"]),
  pic("📱", "phone", "You call people with it.", ["telephone", "cell phone"]), pic("🌳", "tree", "It's tall, with leaves and branches."), pic("🏠", "house", "A place where people live.", ["home"]),
  pic("👓", "glasses", "You wear them to see better.", ["spectacles"]), pic("🍌", "banana", "A long yellow fruit."), pic("🛏️", "bed", "You sleep in it."),
  pic("✏️", "pencil", "You write or draw with it."), pic("🐟", "fish", "It swims in the water."), pic("🥄", "spoon", "You eat soup with it."),
  pic("👟", "shoe", "You wear it on your foot.", ["shoes", "sneaker", "sneakers"]), pic("☀️", "sun", "It shines in the sky all day."), pic("🍰", "cake", "A sweet treat for birthdays."),
  pic("📖", "book", "It has pages. You read it."), pic("☂️", "umbrella", "It keeps you dry in the rain."), pic("🥛", "milk", "A white drink from cows."),
  pic("🧢", "hat", "You wear it on your head.", ["cap"]), pic("🚪", "door", "You open it to walk into a room."), pic("🪟", "window", "You look through it. It lets the light in."),
  pic("🍕", "pizza", "Round, cheesy, and cut into slices."), pic("🍔", "hamburger", "A patty of beef on a bun.", ["burger", "cheeseburger"]), pic("🥚", "egg", "Hens lay them. Good for breakfast.", ["eggs"]),
  pic("🧀", "cheese", "Mice like it. It goes on a sandwich."), pic("🍇", "grapes", "Small round fruit that grows in bunches.", ["grape"]), pic("🍊", "orange", "A round fruit. Its name is also its color."),
  pic("🥕", "carrot", "A long orange vegetable. Rabbits love it.", ["carrots"]), pic("🌽", "corn", "Yellow vegetable you eat off the cob."), pic("🍅", "tomato", "A round red fruit for salads and sauce."),
  pic("🐎", "horse", "A large animal you can ride."), pic("🐄", "cow", "A farm animal that gives milk."), pic("🐖", "pig", "A pink farm animal that says oink."),
  pic("🐔", "chicken", "A farm bird that lays eggs.", ["hen", "rooster"]), pic("🐦", "bird", "It has feathers and flies."), pic("🦆", "duck", "A bird that swims and says quack."),
  pic("🌙", "moon", "You see it in the sky at night."), pic("⭐", "star", "It twinkles in the night sky."), pic("🌧️", "rain", "Water falling from the clouds."), pic("❄️", "snow", "Cold, white, and falls in winter.", ["snowflake"]),
  pic("🌸", "flower", "It blooms and smells sweet.", ["blossom"]), pic("🔨", "hammer", "You hit a nail with it."), pic("🚲", "bike", "Two wheels and pedals.", ["bicycle"]),
  pic("🚚", "truck", "A big vehicle that carries loads."), pic("✈️", "plane", "It flies people through the sky.", ["airplane", "jet"]), pic("🚂", "train", "It runs on tracks."), pic("⛵", "boat", "It floats on the water.", ["sailboat"]),
  pic("🎣", "fishing", "You sit by a lake with a rod and wait.", ["fishing pole", "fishing rod"]), pic("⚽", "ball", "You kick or throw it.", ["soccer ball", "soccer"]), pic("🎸", "guitar", "An instrument with six strings."),
  pic("📺", "television", "You watch shows on it.", ["tv"]), pic("🕐", "clock", "It's on the wall and tells the time."), pic("🔦", "flashlight", "It lights your way in the dark.", ["torch"]), pic("💡", "light bulb", "It lights up a room.", ["light", "lamp", "bulb"])
];

// ---- Choose and answer: any offered answer is right; it's his choice.
const ask = (question, ...options) => ({ id: slug(question), mode: "choice", text: question, say: options[0], accept: options.map(norm), tip: "choose" });
const choices = [
  ask("Coffee or tea?", "coffee", "tea"), ask("Hot or cold?", "hot", "cold"), ask("Dogs or cats?", "dogs", "cats", "dog", "cat"), ask("Morning or night?", "morning", "night"),
  ask("Summer or winter?", "summer", "winter"), ask("Beach or mountains?", "beach", "mountains", "mountain"), ask("Pizza or hamburgers?", "pizza", "hamburgers", "hamburger", "burgers"),
  ask("Eggs or cereal?", "eggs", "cereal"), ask("Ice cream or cake?", "ice cream", "cake"), ask("Sweet or salty?", "sweet", "salty"), ask("Inside or outside?", "inside", "outside"),
  ask("Music or the news?", "music", "news", "the news"), ask("Sit down or go for a walk?", "sit down", "go for a walk", "walk", "sit"), ask("Truck or car?", "truck", "car"),
  ask("Fishing or hunting?", "fishing", "hunting"), ask("Football or baseball?", "football", "baseball"), ask("Rain or sunshine?", "rain", "sunshine", "sun"),
  ask("Red or blue?", "red", "blue"), ask("Now or later?", "now", "later"), ask("Do you want more? Yes or no?", "yes", "no", "yes please", "no thanks", "no thank you"),
  ask("Are you ready? Yes or no?", "yes", "no", "not yet"), ask("Do you like this song? Yes or no?", "yes", "no"), ask("Is it time to eat? Yes or no?", "yes", "no"),
  ask("Should I turn it up or down?", "up", "down"), ask("Left or right?", "left", "right"), ask("Big or small?", "big", "small"), ask("Today or tomorrow?", "today", "tomorrow"),
  ask("Sandwich or soup?", "sandwich", "soup"), ask("Apple or banana?", "apple", "banana"), ask("Movie or a book?", "movie", "book", "a book", "a movie")
];

// ---- Everyday conversations: script training. The other person's line is spoken; he says his.
// A long line earns credit when most of its words came through (`partial`), so a good try isn't a miss.
const PARTIAL = 0.6;
const script = (title, lines) => lines.map(([other, mine], n) => ({
  id: `${slug(title)}-${n + 1}`, mode: "script", group: title, other, text: mine, say: mine,
  accept: [norm(mine)], tip: "phrase", ...(norm(mine).split(" ").length >= 4 ? { partial: PARTIAL } : {})
}));
const scripts = [
  ...script("Saying hello", [["Hi there, how are you?", "I am doing well, thank you."], ["Good to see you.", "It is good to see you too."], ["What have you been up to?", "Not much, just taking it easy."], ["Well, have a good day.", "You too. See you later."]]),
  ...script("Ordering coffee", [["Good morning. What can I get you?", "I would like a coffee, please."], ["What size?", "A large one."], ["Cream and sugar?", "Just cream, please."], ["That will be three dollars.", "Here you go."], ["Have a nice day.", "Thank you. You too."]]),
  ...script("At a restaurant", [["How many in your party?", "Two, please."], ["Can I get you something to drink?", "I will have water, please."], ["Are you ready to order?", "I would like the chicken."], ["How is everything?", "It is very good, thank you."], ["Can I get you anything else?", "Just the check, please."]]),
  ...script("Answering the phone", [["(The phone rings.)", "Hello?"], ["Hi, it's me. How are you?", "I am good. How are you?"], ["Doing fine. Are you busy?", "No, I have time."], ["Do you want to get together this week?", "Yes, I would like that."], ["Great. Talk to you soon.", "Okay. Goodbye."]]),
  ...script("At the door", [["(Someone knocks.)", "Come in."], ["Hi, how are you today?", "I am fine, thank you."], ["I brought you something.", "That is very kind of you."], ["Can I get you anything?", "No, thank you. I am all set."], ["I should get going.", "Thanks for coming by."]]),
  ...script("At the store", [["Can I help you find something?", "I am looking for the milk."], ["It's in the back, on the left.", "Thank you very much."], ["Did you find everything?", "Yes, I did."], ["Do you need a bag?", "Yes, please."], ["Have a good one.", "You too. Goodbye."]]),
  ...script("With family at home", [["What do you want for dinner?", "Let's have chicken tonight."], ["Do you want to watch something?", "Yes, let's watch a movie."], ["Are you warm enough?", "I would like a blanket, please."], ["How was your day?", "I had a good day."], ["Good night. Sleep well.", "Good night. I love you."]]),
  ...script("When I need more time", [["Hi, can I help you?", "Yes. Please give me a minute."], ["Sure, take your time.", "Thank you for waiting."], ["What was that again?", "Let me say it again."], ["I think I understand now.", "Yes, that is right."], ["Glad I could help.", "Thank you for your patience."]])
];

// ---- Tell me about it: free speech. There's no right answer, so it listens for how long he talks.
const talk = (text, talkSec) => ({ id: slug(text), text, talkSec, say: text, accept: [], tip: "talk", group: talkSec <= 5 ? "A few words" : talkSec <= 10 ? "A little more" : "As much as you like" });
const talkItems = [
  talk("What did you have for breakfast?", 3), talk("What is your favorite food?", 3), talk("What is the weather like today?", 3), talk("Who did you see today?", 3),
  talk("What is your favorite season?", 3), talk("What are you going to do today?", 5), talk("What is your favorite song?", 5), talk("Who is your best friend?", 5),
  talk("Tell me about your morning.", 8), talk("Tell me about your home.", 8), talk("Tell me about someone you love.", 8), talk("What do you like to do outside?", 8),
  talk("Tell me about a pet you have had.", 10), talk("What was your first car?", 10), talk("Where did you grow up?", 10), talk("What is your favorite meal to cook?", 10),
  talk("Tell me about your favorite trip.", 15), talk("Tell me about a job you have had.", 15), talk("Tell me about a happy memory.", 15), talk("Tell me what makes you laugh.", 15),
  talk("Tell me how to make a sandwich.", 15), talk("Tell me about your family.", 20), talk("What would you do on a perfect day?", 20), talk("What are you proud of?", 20)
];

export const NEXT_STAGES = [
  { id: "counting", title: "Numbers, days and months", kind: "speech", goal: "Familiar lists that often come easily.", items: counting },
  { id: "finish", title: "Finish the phrase", kind: "speech", goal: "I start it. You finish it.", items: finish },
  { id: "naming", title: "Name the picture", kind: "speech", goal: "Find the word yourself. Hints are there if you want them.", items: naming },
  { id: "choices", title: "Choose and answer", kind: "speech", goal: "Any answer is right. It's your choice.", noRecord: true, items: choices },
  { id: "scripts", title: "Everyday conversations", kind: "speech", goal: "Practise real conversations, one line at a time.", items: scripts },
  { id: "talk", title: "Tell me about it", kind: "talk", goal: "No right answers. Just talk, as much or as little as you like.", noRecord: true, items: talkItems }
];
