import { assertActivatable } from "@athlete-coach/domain";
import {
  createProgramWithStructureInputSchema,
  type CreateProgramWithStructureInput,
  programStructureInputSchema,
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
/**
 * Creating a training program is one transactional user intent, not a
 * sequence of independently durable mutations. Retrying the same creation
 * intent (same creationRequestId) resolves to the same draft.
 */
export class CreateTrainingProgramWithStructure extends ProgramsUseCase {
  async execute(input: CreateProgramWithStructureInput) {
    return this.repository.createWithStructure(
      createProgramWithStructureInputSchema.parse(input),
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
