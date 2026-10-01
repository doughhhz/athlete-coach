import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const root = new URL("../src/presentation/training/", import.meta.url);
async function source(name) {
  return readFile(new URL(name, root), "utf8");
}
test("training tab covers loading error empty active and list states", async () => {
  const text = await source("training-programs-screen.tsx");
  for (const token of [
    "Programa ativo",
    "Você ainda não possui um programa de treino ativo.",
    "Meus programas",
    "Tentar novamente",
    "ActivityIndicator",
    "Criar programa",
    "Biblioteca de exercícios",
  ])
    assert.match(
      text,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
});
test("builder selects canonical exercises and validates planned sets", async () => {
  const text = await source("program-builder-screen.tsx");
  for (const token of [
    "listExercises",
    "getProgram",
    "targetMetric",
    "targetMin",
    "rirMin",
    "restMinSeconds",
    "tempo",
    "loadKind",
    "Salvar e revisar",
    "Editar rascunho",
    "Nenhum dado de execução",
  ])
    assert.match(text, new RegExp(token));
  assert.doesNotMatch(
    text,
    /actual(Reps|Load|Rir|Rest)|start workout|complete set/i,
  );
});
test("details labels prescription as planned and offers revision", async () => {
  const text = await source("program-details-screen.tsx");
  assert.match(text, /ALVOS PLANEJADOS/);
  assert.match(text, /Criar revisão editável/);
  assert.match(text, /Concluído normalmente/);
  assert.match(text, /Arquivado \(retirado\)/);
  // Planned sets are grouped for display ("3 séries × 8–10 reps").
  assert.match(text, /groupPrescriptionSets\(ep\.sets\)/);
  assert.doesNotMatch(text, /recorde pessoal|dados realizados|cronômetro/i);
});
