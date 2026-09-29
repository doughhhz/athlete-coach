import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const personal = await read("app/(tabs)/personal.tsx");
const review = await read("app/coach-proposals/[id].tsx");
const labels = await read("src/presentation/coach/auto-draft-labels.ts");
const components = await read(
  "src/presentation/coach/auto-draft-components.tsx",
);
const gateway = await read(
  "src/infrastructure/coach/supabase-coach-gateway.ts",
);
const ui = [personal, review, labels, components].join("\n");

test("draft authority is a separate setting with off/conservative options", () => {
  assert.ok(components.includes("Criação automática de rascunho"));
  assert.match(labels, /title: "Desligada"/);
  assert.match(labels, /title: "Conservadora"/);
  assert.ok(
    labels.includes(
      "O Personal poderá criar automaticamente um rascunho somente para um conjunto restrito de ajustes. Seu programa ativo não será alterado ou ativado automaticamente.",
    ),
  );
  assert.match(personal, /<DraftAuthoritySection/);
  assert.match(personal, /<AutonomyModeSection/);
  assert.ok(
    labels.includes("Só tem efeito quando o modo do Personal é Proativo."),
  );
});

test("explicit consent with the canonical copy; nothing preselected", () => {
  for (const line of [
    "Quando uma proposta cumprir regras conservadoras, o Personal poderá criar uma nova revisão em rascunho automaticamente.",
    "Seu programa ativo nunca será alterado ou ativado automaticamente.",
    "Você continuará responsável por revisar e ativar a revisão.",
  ])
    assert.ok(labels.includes(line), line);
  assert.match(components, /setConfirming\(true\)/);
  assert.match(components, /Ativar criação conservadora/);
  assert.match(components, /Manter desligada/);
  assert.match(personal, /useState<CoachDraftAuthorityMode \| null>\(null\)/);
});

test("an automatic draft is always surfaced with provenance and a review CTA", () => {
  for (const text of [
    "Rascunho preparado",
    "Rascunho preparado automaticamente",
    "Uma revisão em rascunho foi preparada.",
    "Revisar rascunho",
    "Programa de origem",
    "Nova revisão em rascunho",
    "O que muda",
  ])
    assert.ok(ui.includes(text), text);
  assert.match(personal, /<AutoDraftCard result=\{autoDraft\} \/>/);
  assert.match(components, /pathname: "\/programs\/\[id\]"/);
});

test("history shows the factual materialization source", () => {
  assert.ok(labels.includes("Rascunho criado por você"));
  assert.ok(
    labels.includes("Rascunho preparado automaticamente pelo Personal"),
  );
  assert.match(personal, /materializationOriginLabels/);
  assert.match(review, /materializationOriginLabels/);
});

test("never presents an automatic draft as approval and offers no activation", () => {
  assert.doesNotMatch(
    ui,
    /Proposta aprovada|aprovad[ao] automaticamente|auto-?approved/i,
  );
  assert.doesNotMatch(
    components,
    /activateProgram|materializeCoachProposal|Ativar revisão/,
  );
  assert.doesNotMatch(personal, /activateProgram/);
  assert.doesNotMatch(gateway, /autoMaterialize|autoDraft:\s*true/);
});
