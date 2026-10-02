import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

// Implementation Phase 21 (ADR-0119): the Personal's first program.
const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const [screen, labels, gateway, layout, tabs, training, details, provider] =
  await Promise.all([
    read("src/presentation/training/initial-program-screen.tsx"),
    read("src/presentation/training/initial-program-labels.ts"),
    read(
      "src/infrastructure/initial-program/supabase-initial-program-gateway.ts",
    ),
    read("app/_layout.tsx"),
    read("app/(tabs)/_layout.tsx"),
    read("src/presentation/training/training-programs-screen.tsx").then(
      async (text) =>
        text + (await read("src/presentation/training/programs-screen.tsx")),
    ),
    read("src/presentation/training/program-details-screen.tsx"),
    read("src/infrastructure/application/app-session-provider.tsx"),
  ]);

test("the gateway sends only the mode and the creation intent", () => {
  assert.match(gateway, /"program-generate"/);
  assert.match(gateway, /body: \{ mode, creationRequestId \}/);
});

test("the route is protected and offered once right after onboarding", () => {
  assert.match(layout, /name="initial-program"/);
  assert.match(
    provider,
    /completeOnboarding\.execute\(input\);\s+setInitialProgramOffer\(true\);/,
  );
  assert.match(
    tabs,
    /if \(initialProgramOffer\) router\.push\("\/initial-program"/,
  );
  assert.match(screen, /app\.dismissInitialProgramOffer\(\)/);
});

test("the screen collects the approved questions; equipment is optional", () => {
  for (const id of [
    "intake-pain-yes",
    "intake-pain-notes",
    "intake-medical-yes",
    "intake-preferred",
    "intake-avoided",
    "intake-other-sports",
    "intake-equipment-skip",
    "intake-equipment-inform",
    "initial-program-generate",
    "initial-program-skip",
  ])
    assert.match(screen, new RegExp(`testID="${id}"`), id);
  assert.match(
    screen,
    /draft\.informEquipment\s+\? draft\.availableEquipment\s+: undefined/,
  );
  assert.match(labels, /Opcional\. Se não informar/);
});

test("validation comes from the application schema; no rules in the screen", () => {
  assert.match(screen, /programIntakeInputSchema\.safeParse/);
  assert.doesNotMatch(
    screen,
    /computeInitialProgramEnvelope|validateInitialProgramPlan|buildBasicInitialProgram/,
  );
  assert.doesNotMatch(screen, /@\/infrastructure\//);
});

test("one creation intent per mode; success opens the draft", () => {
  assert.match(
    screen,
    /personal: newIdempotencyKey\(\),\s+basic: newIdempotencyKey\(\)/,
  );
  assert.match(
    screen,
    /router\.replace\(`\/programs\/\$\{result\.programId\}`/,
  );
});

test("basic template only after availability failures, clearly labeled", () => {
  assert.match(
    labels,
    /"program_provider_unavailable",\s+"program_timeout",\s+"program_invalid",\s+"program_failed"/,
  );
  assert.doesNotMatch(
    labels,
    /BASIC_FALLBACK_CODES = new Set\(\[[^\]]*program_blocked/,
  );
  assert.match(
    screen,
    /offerBasic: mode === "personal" && canOfferBasicTemplate\(code\)/,
  );
  assert.match(labels, /não é personalizado pelo Personal/);
  assert.match(labels, /criado como rascunho/);
});

test("blocked generation recommends professional evaluation", () => {
  assert.match(labels, /restrição médica/);
  assert.match(labels, /avaliação profissional/);
  assert.match(screen, /testID="initial-program-refusal"/);
});

test("Treino always offers the Personal; details show the justifications", () => {
  assert.match(training, /testID="training-initial-program"/);
  assert.match(details, /testID="program-description"/);
  assert.match(details, /ep\.instructions/);
  assert.match(details, /d\.notes/);
  assert.match(details, /weekdayNames\[d\.preferredWeekday\]/);
});
