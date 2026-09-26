import assert from "node:assert/strict";
import test from "node:test";
import { SupabaseExerciseCatalogRepository } from "../src/supabase/exercise-catalog-repositories.ts";

test("catalog adapter maps RPC rows into domain summaries", async () => {
  let args;
  const client = {
    rpc: async (name, input) => {
      args = { name, input };
      return {
        data: [
          {
            id: "50000000-0000-4000-8000-000000000001",
            slug: "barbell-bench-press",
            name_pt: "Supino reto com barra",
            name_en: "Barbell bench press",
            short_description_pt: "Descrição",
            movement_pattern: "horizontal_push",
            mechanics: "compound",
            laterality: "bilateral",
            difficulty: "intermediate",
            primary_muscles: ["Peitoral maior"],
            primary_muscle_groups: ["Peitoral"],
            equipment: ["Barra"],
          },
        ],
        error: null,
      };
    },
    from() {
      throw new Error("not used");
    },
  };
  const result = await new SupabaseExerciseCatalogRepository(client).list({
    query: "supino",
    equipmentSlug: "barbell",
  });
  assert.equal(args.name, "search_exercise_catalog");
  assert.deepEqual(args.input, {
    p_query: "supino",
    p_equipment_slug: "barbell",
  });
  assert.equal(result[0].namePt, "Supino reto com barra");
  assert.deepEqual(result[0].primaryMuscleGroups, ["Peitoral"]);
});
