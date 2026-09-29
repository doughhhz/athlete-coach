import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const labels = await read("src/presentation/coach/draft-review-labels.ts");
const components = await read(
  "src/presentation/coach/draft-review-components.tsx",
);
const personal = await read("app/(tabs)/personal.tsx");
const review = await read("app/coach-proposals/[id].tsx");
const progress = await read("src/presentation/performance/progress-screen.tsx");
const autoDraft = await read(
  "src/presentation/coach/auto-draft-components.tsx",
);
const ui = [labels, components, personal, review, progress].join("\n");

test("factual review status labels", () => {
  for (const text of [
    "Aguardando revisão",
    "Ativado sem alterações",
    "Ativado após alterações",
    "Arquivado sem ativação",
  ])
    assert.ok(labels.includes(text), text);
  assert.match(personal, /draftReviewStatusLabels\[/);
});

test("review detail shows before / prepared / reviewed and the change label", () => {
  for (const text of [
    "Antes:",
    "Preparado:",
    "Ativado",
    "Revisado (rascunho atual)",
  ])
    assert.ok(components.includes(text), text);
  assert.ok(labels.includes("Alterado durante a revisão"));
  assert.match(review, /<DraftReviewDetail evidence=\{review\} \/>/);
  assert.ok(
    labels.includes("não identifica quem fez cada alteração"),
    "does not attribute edits to a person",
  );
});

test("progress shows transparent counts under 'Revisões do Personal'", () => {
  assert.ok(components.includes("Revisões do Personal"));
  assert.match(progress, /<DraftReviewSummary/);
  assert.match(components, /rascunho\(s\) automático\(s\)/);
});

test("no acceptance, success, trust, score or gamification wording", () => {
  assert.doesNotMatch(
    ui,
    /aceit|sucesso|confian|pontua|score|acurácia|taxa de|%\s*(de )?(aceit|acerto)|aprovad[ao] automaticamente|👍|👎|boa proposta|má proposta/i,
  );
});

test("awaiting review keeps the CTA to the existing draft; no activation control", () => {
  assert.ok(autoDraft.includes("Revisar rascunho"));
  assert.doesNotMatch(
    components,
    /activateProgram|materializeCoachProposal|onPress/,
  );
});

test("review evidence stays separate from physiological outcomes", () => {
  assert.ok(labels.includes("não se a proposta estava certa"));
  assert.ok(labels.includes("só é observado depois da ativação"));
});
