import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const personal = await read("app/(tabs)/personal.tsx");
const review = await read("app/coach-proposals/[id].tsx");
const labels = await read("src/presentation/coach/governance-labels.ts");
const gateway = await read(
  "src/infrastructure/coach/supabase-coach-gateway.ts",
);
const requestId = await read("src/presentation/coach/analysis-request-id.ts");
const presentation = [personal, review, labels].join("\n");

test("mode copy: manual and proactive, explicit consent and cost notice", () => {
  for (const text of [
    "Modo do Personal",
    "O Personal analisa seus dados, mas só prepara uma proposta quando você pedir.",
    "Após uma análise, o Personal pode preparar uma proposta automaticamente. Nenhuma alteração será aplicada ao programa sem sua revisão.",
    "Após uma análise, o Personal poderá preparar propostas de ajuste automaticamente. Nenhuma alteração será aplicada ao seu treino sem sua revisão.",
    "Esse modo pode realizar uma chamada adicional ao serviço de IA.",
  ])
    assert.ok(presentation.includes(text), text);
  assert.match(personal, /Ativar modo proativo/);
  assert.match(personal, /Manter manual/);
  // Opt-in requires a second, explicit action (no preselection).
  assert.match(personal, /setConfirming\(true\)/);
});

test("badges use governance language, never risk levels", () => {
  for (const text of [
    "Solicitada por você",
    "Preparada pelo Personal",
    "Revisão padrão",
    "Revisão reforçada",
  ])
    assert.ok(labels.includes(text), text);
  assert.doesNotMatch(
    presentation,
    /baixo risco|alto risco|risco baixo|risco alto|risk score/i,
  );
  assert.match(personal, /DecisionBadges decision=\{item\}/);
});

test("elevated review requires an unchecked-by-default confirmation", () => {
  assert.ok(
    labels.includes(
      "Esta proposta altera uma parte mais estrutural/intensa da prescrição. Revise os detalhes antes de criar a revisão.",
    ),
  );
  assert.ok(labels.includes("Revisei as alterações propostas"));
  assert.match(review, /useState\(false\)/);
  assert.match(review, /accessibilityRole="checkbox"/);
  assert.match(review, /elevated && !reviewed/);
  assert.match(review, /Criar revisão em rascunho/);
});

test("client never sends origin or review class; only a confirmation flag and an idempotency key", () => {
  assert.doesNotMatch(gateway, /reviewClass|proposalOrigin|origin:/);
  assert.match(gateway, /confirmElevatedReview/);
  assert.match(gateway, /analysisRequestId/);
  assert.match(requestId, /4xxx-yxxx/);
});

test("proactive statuses have honest copy and no fake proposal", () => {
  for (const text of [
    "O Personal preparou uma proposta para sua revisão.",
    "O Personal não identificou um ajuste para propor agora.",
    "Por segurança, nenhuma proposta de treino foi preparada.",
    "Não foi possível preparar a proposta agora.",
  ])
    assert.ok(labels.includes(text), text);
  assert.doesNotMatch(personal, /activateProgram|materializeCoachProposal/);
});
