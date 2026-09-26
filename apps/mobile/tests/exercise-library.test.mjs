import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("exercise library exposes search, filters and all async states", async () => {
  const source = await readFile(
    new URL(
      "../src/presentation/exercises/exercise-library-screen.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  for (const expected of [
    "Buscar por nome ou alias",
    "Grupo muscular",
    "Equipamento",
    "Carregando exercícios",
    "Tentar novamente",
    "Nenhum exercício corresponde",
  ]) {
    assert.match(source, new RegExp(expected));
  }
});
test("exercise details stays factual and has honest media fallback", async () => {
  const source = await readFile(
    new URL(
      "../src/presentation/exercises/exercise-details-screen.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  for (const expected of [
    "Demonstração visual ainda não disponível",
    "Músculos primários",
    "Erros comuns",
    "Notas de segurança",
    "não implica substituição\\s+contextual",
  ]) {
    assert.match(source, new RegExp(expected));
  }
  assert.doesNotMatch(source, /\b(?:sets|reps|RIR|carga|descanso|tempo)\b/i);
});
