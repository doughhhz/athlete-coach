import assert from "node:assert/strict";
import test from "node:test";
import {
  BuildAthleteTrainingDossier,
  BuildCoachDraftReviews,
  GetCoachDraftReviewEvidence,
  ListCoachDraftReviewHistory,
} from "../src/index.ts";

const set = (id, sequence, change = {}) => ({
  id,
  sequence,
  targetMetric: "reps",
  targetMin: 8,
  targetMax: 10,
  rirMin: 2,
  rirMax: 2,
  restMinSeconds: 120,
  restMaxSeconds: 120,
  tempo: null,
  loadKind: "absolute",
  loadKg: 60,
  ...change,
});
const program = (id, sets, change = {}) => ({
  id,
  athleteId: "athlete",
  athleteGoalId: null,
  name: "P",
  description: null,
  status: "active",
  revision: 1,
  supersedesProgramId: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  activatedAt: "2026-10-01T00:00:00.000Z",
  completedAt: null,
  archivedAt: null,
  blocks: [
    {
      id: `${id}-b`,
      sequence: 1,
      name: "B",
      description: null,
      weeks: [
        {
          id: `${id}-w`,
          sequence: 1,
          name: null,
          notes: null,
          days: [
            {
              id: `${id}-d`,
              sequence: 1,
              name: "A",
              preferredWeekday: null,
              notes: null,
              prescriptions: [
                {
                  id: `${id}-p`,
                  exerciseId: "bench",
                  exerciseName: "Supino",
                  sequence: 1,
                  instructions: null,
                  athleteCues: null,
                  sets,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  ...change,
});
const source = program("source", [set("s1", 1)]);
const decision = (id, status, draftId, change = {}) => ({
  id,
  status,
  materializedProgramId: draftId,
  materializedAt: draftId ? `2026-10-0${id.length}T00:00:00.000Z` : null,
  materializationOrigin: draftId ? "auto_draft" : null,
  proposalOrigin: "proactive",
  approvedAt: null,
  proposal: {
    sourceProgramId: "source",
    sourceProgramRevision: 1,
    actions: [
      {
        kind: "adjust_prescription_rir",
        trainingDayId: "source-d",
        exercisePrescriptionId: "source-p",
        prescriptionSetId: "s1",
        rirMin: 3,
        rirMax: 3,
        rationale: "r",
        evidence: [],
      },
    ],
  },
  ...change,
});
const drafts = {
  unchanged: program("unchanged", [set("u1", 1, { rirMin: 3, rirMax: 3 })], {
    status: "draft",
    activatedAt: null,
  }),
  edited: program("edited", [set("e1", 1, { rirMin: 4, rirMax: 4 })], {
    activatedAt: "2026-10-05T00:00:00.000Z",
  }),
};
function setup(decisions) {
  const loads = [];
  const programs = {
    get: async (id) => {
      loads.push(id);
      if (id === "boom") throw new Error("network");
      return id === "source" ? source : (drafts[id] ?? null);
    },
  };
  return {
    loads,
    reviews: new BuildCoachDraftReviews(
      { list: async () => decisions },
      programs,
    ),
  };
}

test("only materialized decisions have review evidence", async () => {
  const { reviews } = setup([
    decision("a", "proposed", null),
    decision("bb", "rejected", null),
    decision("ccc", "stale", null),
    decision("dddd", "materialized", "unchanged"),
  ]);
  const items = await reviews.execute();
  assert.deepEqual(
    items.map((item) => [item.decisionId, item.reviewStatus]),
    [["dddd", "awaiting_review"]],
  );
});

test("programs are loaded once each; failures degrade to limited data", async () => {
  const { reviews, loads } = setup([
    decision("aa", "materialized", "unchanged"),
    decision("bbb", "materialized", "edited"),
    decision("cccc", "materialized", "boom"),
  ]);
  const items = await reviews.execute();
  assert.equal(loads.filter((id) => id === "source").length, 1);
  const byId = Object.fromEntries(items.map((item) => [item.decisionId, item]));
  assert.equal(byId.bbb.reviewStatus, "activated_with_edits");
  assert.equal(byId.cccc.reviewStatus, "limited_data");
});

test("single evidence lookup and bounded history", async () => {
  const { reviews } = setup([
    decision("aa", "materialized", "unchanged"),
    decision("bbb", "materialized", "edited"),
  ]);
  const evidence = await new GetCoachDraftReviewEvidence(reviews).execute(
    "bbb",
  );
  assert.deepEqual(evidence.changeCategories, ["rir_changed"]);
  assert.equal(
    await new GetCoachDraftReviewEvidence(reviews).execute("zz"),
    null,
  );
  const history = await new ListCoachDraftReviewHistory(reviews).execute(1);
  assert.equal(history.included, 1);
  assert.equal(history.hasMore, true);
  assert.equal(history.counts.byMaterializationOrigin.auto_draft, 2);
  assert.doesNotMatch(
    JSON.stringify(history),
    /(rates?|scorew*|trustw*|acceptw*|rewardw*)/i,
  );
});

test("dossier v6 embeds the bounded review history only when composed", async () => {
  const base = [
    {
      execute: async () => ({
        athlete: { id: "athlete", userId: "user" },
        profile: { timezone: "UTC", preferredName: null },
        activeGoal: null,
        trainingContext: null,
        availableWeekdays: [],
        latestWeight: null,
      }),
    },
    { getActive: async () => null },
    { getInProgress: async () => null },
    { listHistoricalSessions: async () => [] },
    () => new Date("2026-10-06T00:00:00.000Z"),
    null,
    null,
  ];
  const without = await new BuildAthleteTrainingDossier(...base).execute();
  assert.equal(without.schemaVersion, "athlete-training-dossier-v7");
  assert.equal(without.draftReviewHistory, null);
  const { reviews } = setup([decision("aa", "materialized", "unchanged")]);
  const withReviews = await new BuildAthleteTrainingDossier(
    ...base,
    new ListCoachDraftReviewHistory(reviews),
  ).execute();
  assert.equal(
    withReviews.draftReviewHistory.items[0].reviewStatus,
    "awaiting_review",
  );
  assert.equal("proposal" in withReviews.draftReviewHistory.items[0], false);
  assert.deepEqual(
    JSON.parse(JSON.stringify(withReviews)),
    JSON.parse(
      JSON.stringify(
        await new BuildAthleteTrainingDossier(
          ...base,
          new ListCoachDraftReviewHistory(reviews),
        ).execute(),
      ),
    ),
  );
});
