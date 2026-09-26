import { assertActivatable } from "@athlete-coach/domain";
import {
  createProgramDraftInputSchema,
  programStructureInputSchema,
  type CreateProgramDraftInput,
  type ProgramStructureInput,
} from "./schemas.ts";
import type { TrainingProgramRepository } from "./ports.ts";
class ProgramsUseCase {
  protected readonly repository: TrainingProgramRepository;
  constructor(repository: TrainingProgramRepository) {
    this.repository = repository;
  }
}
export class ListTrainingPrograms extends ProgramsUseCase {
  execute() {
    return this.repository.list();
  }
}
export class GetTrainingProgram extends ProgramsUseCase {
  execute(id: string) {
    return this.repository.get(id);
  }
}
export class GetActiveTrainingProgram extends ProgramsUseCase {
  execute() {
    return this.repository.getActive();
  }
}
export class CreateTrainingProgramDraft extends ProgramsUseCase {
  execute(input: CreateProgramDraftInput) {
    return this.repository.createDraft(
      createProgramDraftInputSchema.parse(input),
    );
  }
}
export class SaveTrainingProgramStructure extends ProgramsUseCase {
  execute(id: string, input: ProgramStructureInput) {
    return this.repository.saveStructure(
      id,
      programStructureInputSchema.parse(input),
    );
  }
}
export class ActivateTrainingProgram extends ProgramsUseCase {
  async execute(id: string) {
    const program = await this.repository.get(id);
    if (!program) throw new Error("Programa não encontrado.");
    assertActivatable(program);
    return this.repository.activate(id);
  }
}
export class CloneTrainingProgramAsDraft extends ProgramsUseCase {
  execute(id: string) {
    return this.repository.cloneAsDraft(id);
  }
}
export class CompleteTrainingProgram extends ProgramsUseCase {
  execute(id: string) {
    return this.repository.complete(id);
  }
}
export class ArchiveTrainingProgram extends ProgramsUseCase {
  execute(id: string) {
    return this.repository.archive(id);
  }
}
