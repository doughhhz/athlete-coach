export const movementPatterns = [
  "horizontal_push",
  "horizontal_pull",
  "vertical_push",
  "vertical_pull",
  "squat",
  "hinge",
  "lunge",
  "knee_flexion",
  "knee_extension",
  "elbow_flexion",
  "elbow_extension",
  "shoulder_abduction",
  "shoulder_flexion",
  "calf_raise",
  "hip_abduction",
  "hip_adduction",
  "trunk_flexion",
  "trunk_extension",
  "anti_extension",
  "anti_rotation",
  "carry",
  "other",
] as const;
export type MovementPattern = (typeof movementPatterns)[number];

export const exerciseMechanics = ["compound", "isolation"] as const;
export type ExerciseMechanics = (typeof exerciseMechanics)[number];
export const exerciseLateralities = [
  "bilateral",
  "unilateral",
  "alternating",
] as const;
export type ExerciseLaterality = (typeof exerciseLateralities)[number];
export const exerciseDifficulties = [
  "beginner",
  "intermediate",
  "advanced",
] as const;
export type ExerciseDifficulty = (typeof exerciseDifficulties)[number];
export const muscleRoles = ["primary", "secondary", "stabilizer"] as const;
export type MuscleRole = (typeof muscleRoles)[number];
export const instructionSections = [
  "setup",
  "execution",
  "breathing_cue",
  "common_mistake",
  "safety_note",
] as const;
export type InstructionSection = (typeof instructionSections)[number];
export const exerciseRelationTypes = [
  "variation_of",
  "similar_pattern",
  "similar_target",
  "equipment_alternative",
  "regression",
  "progression",
] as const;
export type ExerciseRelationType = (typeof exerciseRelationTypes)[number];

export type BodyRegion = Readonly<{
  id: string;
  slug: string;
  nameEn: string;
  namePt: string;
}>;
export type MuscleGroup = Readonly<{
  id: string;
  bodyRegionId: string;
  slug: string;
  nameEn: string;
  namePt: string;
  description: string | null;
}>;
export type Muscle = Readonly<{
  id: string;
  muscleGroupId: string;
  slug: string;
  nameEn: string;
  namePt: string;
  anatomicalName: string | null;
  description: string | null;
}>;
export type Equipment = Readonly<{
  id: string;
  slug: string;
  nameEn: string;
  namePt: string;
}>;
export type ExerciseMuscle = Readonly<{
  muscle: Muscle;
  group: MuscleGroup;
  role: MuscleRole;
}>;
export type ExerciseInstruction = Readonly<{
  section: InstructionSection;
  sortOrder: number;
  contentPt: string;
}>;
export type ExerciseRelation = Readonly<{
  type: ExerciseRelationType;
  exercise: Pick<Exercise, "id" | "slug" | "namePt" | "nameEn">;
  notePt: string | null;
}>;

export type Exercise = Readonly<{
  id: string;
  slug: string;
  namePt: string;
  nameEn: string;
  shortDescriptionPt: string;
  movementPattern: MovementPattern;
  mechanics: ExerciseMechanics;
  laterality: ExerciseLaterality;
  difficulty: ExerciseDifficulty | null;
  isActive: boolean;
}>;

export type ExerciseSummary = Exercise &
  Readonly<{
    primaryMuscles: readonly string[];
    primaryMuscleGroups: readonly string[];
    equipment: readonly string[];
  }>;

export type ExerciseDetails = Exercise &
  Readonly<{
    aliases: readonly string[];
    muscles: readonly ExerciseMuscle[];
    equipment: readonly Equipment[];
    instructions: readonly ExerciseInstruction[];
    relations: readonly ExerciseRelation[];
    hasMedia: boolean;
  }>;

export type ExerciseCatalogFilters = Readonly<{
  query?: string;
  muscleGroupSlug?: string;
  muscleSlug?: string;
  equipmentSlug?: string;
  movementPattern?: MovementPattern;
}>;

export type ExerciseCatalogFacets = Readonly<{
  muscleGroups: readonly MuscleGroup[];
  muscles: readonly Muscle[];
  equipment: readonly Equipment[];
}>;
