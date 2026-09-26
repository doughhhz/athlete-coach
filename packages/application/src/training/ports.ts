import type {
  TrainingProgram,
  TrainingProgramSummary,
} from "@athlete-coach/domain";
import type {
  CreateProgramDraftInput,
  ProgramStructureInput,
} from "./schemas.ts";
export interface TrainingProgramRepository {
  list(): Promise<readonly TrainingProgramSummary[]>;
  get(id: string): Promise<TrainingProgram | null>;
  getActive(): Promise<TrainingProgram | null>;
  createDraft(input: CreateProgramDraftInput): Promise<TrainingProgram>;
  saveStructure(
    id: string,
    structure: ProgramStructureInput,
  ): Promise<TrainingProgram>;
  activate(id: string): Promise<TrainingProgram>;
  cloneAsDraft(id: string): Promise<TrainingProgram>;
  complete(id: string): Promise<TrainingProgram>;
  archive(id: string): Promise<TrainingProgram>;
}
