# Research basis for Speak Again

SEEDSED. Purpose: the evidence that shaped this app, and its limits. Gathered 2026-10-25 from
abstracts and summaries. Full texts were mostly not available, so effect sizes are not quoted.
This is not medical advice. An assessment by a speech-language pathologist (SLP) is the best next step.

## 1. Can speech still improve more than a year after a stroke?

Yes. Gains are smaller and slower than in the first months, but they are real with enough practice.

- **FCET2EC (Breitenstein et al., Lancet 2017).** 156 people, 1–6 years after stroke. Three weeks of
  intensive therapy improved everyday verbal communication, and the gains held at 6 months. Age and
  time since stroke did not prevent improvement. This trial was about aphasia (language), not tongue
  or lip control.
  [NIHR summary](https://evidence.nihr.ac.uk/alert/intensive-speech-therapy-helps-stroke-survivors-with-persistent-communication-difficulties)
- **Sound Production Treatment (Wambaugh and colleagues, 2012–2023).** Several small studies of
  chronic apraxia of speech (difficulty planning mouth movements) after stroke. Articulation improved
  with drills built on modelling, placement cues and repetition. A spread-out schedule kept untreated
  words better than an intense one.
  [JSLHR 2017](https://pubs.asha.org/doi/full/10.1044/2017_JSLHR-S-16-0249) ·
  [Intensity, 2018](https://figshare.com/articles/Treatment_intensity_in_acquired_apraxia_of_speech_Wambaugh_et_al_2018_/5734053)

## 2. Can self-practice on a computer or tablet help?

Yes, for the words that are practised.

- **Big CACTUS (Palmer et al., Lancet Neurology 2019).** 278 people with long-standing aphasia.
  Six months of self-managed daily computer practice improved word finding on practised words. It
  did not improve conversation. [Sheffield trial page](https://sheffield.ac.uk/ctru/completed-trials/big-cactus) ·
  [NIHR summary](https://evidence.nihr.ac.uk/alert/computerised-speech-and-language-therapy-can-help-people-with-aphasia-find-words-following-a-stroke)
- **Ballard et al., AJSLP 2019.** The closest match to this app: an iPad app that used automatic
  speech recognition to give feedback during home practice. Five people with apraxia of speech and
  aphasia after stroke. Recognition agreed with human listeners about 80% of the time. All five
  improved word accuracy and kept it a month later.
  [ASHA](https://pubs.asha.org/doi/10.1044/2018_AJSLP-MSC18-18-0109)

## 3. Should he do tongue exercises?

Practise speech itself rather than tongue-strength exercises. A systematic review found the evidence
that non-speech mouth exercises improve speech "equivocal" (McCauley et al., AJSLP 2009).
[ASHA](https://pubs.asha.org/doi/10.1044/1058-0360(2009/09-0006))
So the app teaches tongue and lip placement *while saying real sounds and words*, which is the
"articulatory-kinematic" approach with the strongest evidence for apraxia of speech.

## 4. How should practice be organised?

From the principles of motor learning (Maas et al., AJSLP 2008, and later apraxia studies):
- The **amount of practice matters most**. Ballard's participants did about 100 tries a session,
  4 sessions a week.
- **Constant feedback helps in the moment, but less frequent feedback helps learning last.** The
  evidence is mixed and from small studies.
- **Spread-out practice** (a little every day) maintains gains better than rare marathon sessions.
[ASHA](https://pubs.asha.org/doi/10.1044/1058-0360%282008/025%29)

## 5. Technical findings

- **Apple's built-in speech recognition is not available in home-screen web apps on iPad and
  iPhone.** WebKit bug 225298 was closed "LATER" with no fix.
  [WebKit](https://bugs.webkit.org/show_bug.cgi?id=225298) So the app brings its own recognizer.
- **Vosk** (Kaldi compiled to WebAssembly, Apache-2.0) runs fully on the device. The small US-English
  model is 41 MB with 152,217 words, and it can be limited to a short list of expected words. In this
  project's browser test it transcribed an 8-second clip exactly in about 1 second, and returned
  "unknown" rather than forcing a match when the words weren't on the list.
- **Recognition is less accurate for impaired speech**, especially severe dysarthria. That's why the
  app never calls a try "wrong", lets a helper overrule it, and offers "Hear myself" playback.
  [Example: JSLHR 2024](https://pubs.asha.org/doi/10.1044/2024_JSLHR-24-00122)

## What this means for him

- Dysarthria (weak or slow muscles), apraxia (trouble planning movements) and aphasia (trouble
  finding words) need different emphasis. "Some words come out, others don't" fits apraxia and
  aphasia. An SLP evaluation would tell which, and could tune this app's word lists.
- Short daily sessions, many repetitions, real words, and stopping before frustration.
