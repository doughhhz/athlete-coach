import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

// Personal tab as a chat (ADR-0123): only what the product really does.
const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const [screen, components] = await Promise.all([
  read("app/(tabs)/personal.tsx"),
  read("src/presentation/coach/chat-components.tsx"),
]);
const text = screen + components;

test("chat layout: header, bubbles, typing, suggestions, fixed composer", () => {
  for (const part of [
    "<PersonalHeader",
    "<UserMessage",
    "<Analysis",
    "<TypingIndicator",
    "<QuickSuggestionGrid",
    "<ChatComposer",
    "KeyboardAvoidingView",
  ])
    assert.ok(screen.includes(part), part);
  // Suggestions only prefill the question; nothing is sent automatically.
  assert.match(screen, /onPick=\{setQuestion\}/);
  // The name comes from the authenticated profile, never hardcoded.
  assert.match(screen, /snapshot\?\.profile\?\.preferredName/);
  assert.doesNotMatch(text, /Carlos|Lucas/);
});

test("no capability the product does not have", () => {
  assert.doesNotMatch(
    text,
    /Online agora|camera|microphone|"mic|attach|anexo|galeria|video|vídeo|Minha dieta|ajustar treino e dieta/i,
  );
});

test("E2E anchors survive", () => {
  for (const anchor of [
    'testID="coach-question"',
    'testID="coach-send"',
    '"coach-analysis"',
    'testID="coach-error"',
    'testID="coach-no-proposal"',
    "Ver proposta de ajuste",
    "Revisar proposta",
  ])
    assert.ok(text.includes(anchor), anchor);
});
