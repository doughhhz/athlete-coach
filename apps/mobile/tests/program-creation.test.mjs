import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

// Corrective pass after Implementation Phase 19 (ADR-0100..0102): a new
// program is created by ONE atomic, idempotent call.
const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const builder = await read(
  "src/presentation/training/program-builder-screen.tsx",
);
const gateway = await read("src/presentation/auth/app-session.ts");
const save = builder.match(/async function save\(\) \{[\s\S]*?\n  \}/)[0];

test("saving a new program calls one atomic creation method", () => {
  assert.match(
    save,
    /app\.createProgramWithStructure\(\{\s+creationRequestId,\s+name,\s+structure,\s+\}\)/,
  );
  assert.doesNotMatch(builder, /createProgramDraft/);
  assert.equal(
    [...save.matchAll(/app\.\w+\(/g)].length,
    2,
    "create (new) or save (existing)",
  );
  assert.match(
    save,
    /if \(id\) \{[\s\S]*app\.saveProgramStructure\(programId, structure\)[\s\S]*\} else \{[\s\S]*createProgramWithStructure/,
  );
});

test("the request id is generated once per creation intent and reused on retry", () => {
  assert.match(
    builder,
    /\[creationRequestId\] = useState<string>\(newIdempotencyKey\)/,
  );
  assert.equal(
    [...builder.matchAll(/newIdempotencyKey/g)].length,
    2,
    "import + one generation",
  );
  assert.doesNotMatch(save, /newIdempotencyKey|setCreationRequestId/);
});

test("a failure keeps the local tree and the dirty guard; success clears it", () => {
  const failure = save.slice(save.indexOf("} catch (e) {"));
  assert.match(failure, /track\("save_failed"\)/);
  assert.doesNotMatch(
    failure,
    /setStructure|setSelected|router\.|setSavedProgramId/,
  );
  assert.ok(
    save.indexOf('track("save_succeeded")') >
      save.indexOf("createProgramWithStructure"),
  );
  assert.match(
    builder,
    /if \(savedProgramId && !session\.dirty\)\s+router\.replace/,
  );
});

test("a conflict is shown factually and offers the already-created draft", () => {
  assert.match(save, /e instanceof ProgramCreationConflictError/);
  assert.ok(builder.includes("Abrir o programa já criado"));
});

test("the gateway exposes no second draft-insertion path", () => {
  assert.match(gateway, /createProgramWithStructure\(/);
  assert.doesNotMatch(gateway, /createProgramDraft/);
});
