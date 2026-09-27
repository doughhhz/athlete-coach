import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const screen = await readFile(
  new URL("../app/(tabs)/personal.tsx", import.meta.url),
  "utf8",
);
test("Personal offers question, loading, structured sections, retry and safe unavailable UX", () => {
  for (const text of [
    "Pergunte ao seu Personal",
    "Analisando…",
    "Resumo",
    "Observações",
    "Sugestões",
    "O que ainda falta saber",
    "Tentar novamente",
  ])
    assert.match(screen, new RegExp(text));
});
test("Personal has no program mutation action", () => {
  assert.doesNotMatch(
    screen,
    /Aplicar recomendação|cloneProgram|activateProgram|saveProgramStructure/,
  );
});
