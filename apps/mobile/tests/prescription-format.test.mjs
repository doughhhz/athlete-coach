import assert from "node:assert/strict";
import test from "node:test";
import {
  formatRest,
  groupPrescriptionSets,
} from "../src/presentation/training/prescription-format.ts";

const set = (sequence, change = {}) => ({
  id: `s${sequence}`,
  sequence,
  targetMetric: "reps",
  targetMin: 8,
  targetMax: 10,
  rirMin: 2,
  rirMax: 2,
  restMinSeconds: 120,
  restMaxSeconds: 180,
  tempo: null,
  loadKind: "athlete_selected",
  loadKg: null,
  ...change,
});

test("identical consecutive sets read as one line with clear details", () => {
  assert.deepEqual(groupPrescriptionSets([set(2), set(1), set(3)]), [
    {
      headline: "3 séries × 8–10 reps",
      details: ["RIR 2", "Descanso 2–3 min", "Carga: você escolhe pelo RIR"],
    },
  ]);
});

test("different sets stay separate, in order, with their own details", () => {
  const groups = groupPrescriptionSets([
    set(1, { loadKind: "absolute", loadKg: 40 }),
    set(2, { loadKind: "absolute", loadKg: 40 }),
    set(3, {
      targetMetric: "seconds",
      targetMin: 30,
      targetMax: 30,
      rirMin: null,
      rirMax: null,
      restMinSeconds: 90,
      restMaxSeconds: 90,
      tempo: "3-1-X-0",
      loadKind: "unprescribed",
    }),
  ]);
  assert.deepEqual(groups, [
    {
      headline: "2 séries × 8–10 reps",
      details: ["RIR 2", "Descanso 2–3 min", "Carga 40 kg"],
    },
    { headline: "1 série × 30 s", details: ["Descanso 90 s", "Tempo 3-1-X-0"] },
  ]);
});

test("rest in whole minutes reads as minutes; otherwise seconds", () => {
  assert.equal(formatRest(60, 60), "1 min");
  assert.equal(formatRest(120, 180), "2–3 min");
  assert.equal(formatRest(90, 120), "90–120 s");
  assert.equal(formatRest(30, 45), "30–45 s");
  assert.equal(formatRest(0, 0), "0 s");
});
