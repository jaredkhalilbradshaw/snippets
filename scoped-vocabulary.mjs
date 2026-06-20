/**
 * Reusable idea:
 * Let users teach an app their preferred verbs without polluting every context.
 * Normalize input, preserve canonical casing, deduplicate case-insensitively,
 * and scope additions to a category.
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const BUILT_INS = {
  focus: ["Work on", "Draft", "Review"],
  chore: ["Tidy", "Clean", "Prepare"],
  recovery: ["Rest", "Stretch", "Reset"]
};

export function normalizePhrase(value, maxLength = 40) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function emptyVocabulary() {
  return Object.fromEntries(Object.keys(BUILT_INS).map(category => [category, []]));
}

export function phrasesFor(category, customVocabulary) {
  const seen = new Set();
  return [...BUILT_INS[category], ...customVocabulary[category]].flatMap(candidate => {
    const phrase = normalizePhrase(candidate);
    const key = phrase.toLocaleLowerCase();
    if (!phrase || seen.has(key)) return [];
    seen.add(key);
    return [phrase];
  });
}

export function addPhrase(customVocabulary, category, candidate) {
  const phrase = normalizePhrase(candidate);
  if (!phrase) return null;

  const canonical = phrasesFor(category, customVocabulary)
    .find(existing => existing.toLocaleLowerCase() === phrase.toLocaleLowerCase());
  if (canonical) return { vocabulary: customVocabulary, phrase: canonical };

  return {
    vocabulary: {
      ...customVocabulary,
      [category]: [...customVocabulary[category], phrase]
    },
    phrase
  };
}

function demo() {
  const initial = emptyVocabulary();
  const added = addPhrase(initial, "focus", "  Follow   up ");
  assert.equal(added.phrase, "Follow up");
  assert.deepEqual(phrasesFor("focus", added.vocabulary), ["Work on", "Draft", "Review", "Follow up"]);
  assert.deepEqual(phrasesFor("chore", added.vocabulary), BUILT_INS.chore);

  const reusedCustom = addPhrase(added.vocabulary, "focus", "FOLLOW UP");
  const reusedBuiltIn = addPhrase(added.vocabulary, "focus", " draft ");
  assert.equal(reusedCustom.phrase, "Follow up");
  assert.equal(reusedBuiltIn.phrase, "Draft");
  assert.equal(reusedCustom.vocabulary, added.vocabulary, "duplicates should not allocate new state");
  console.log("Scoped vocabulary:", added.vocabulary);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) demo();

