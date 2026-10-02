import type {
  TrainingProgram,
  TrainingProgramSummary,
} from "@athlete-coach/domain";
import type {
  CreateProgramWithStructureInput,
  ProgramStructureInput,
} from "./schemas.ts";
/**
 * The same creationRequestId was already used for a different program
 * payload. Nothing was created or modified; the existing draft (owned by the
 * same athlete) is identified when it can be read.
 */
export class ProgramCreationConflictError extends Error {
  readonly existingProgramId: string | null;
  constructor(existingProgramId: string | null) {
    super(
      "Este programa já foi criado em uma tentativa anterior com outro conteúdo. Nada foi alterado.",
    );
    this.existingProgramId = existingProgramId;
  }
}
export interface TrainingProgramRepository {
  list(): Promise<readonly TrainingProgramSummary[]>;
  get(id: string): Promise<TrainingProgram | null>;
  getActive(): Promise<TrainingProgram | null>;
  /** Atomic and idempotent: zero programs or one complete draft. */
  createWithStructure(
    input: CreateProgramWithStructureInput,
  ): Promise<TrainingProgram>;
  saveStructure(
    id: string,
    structure: ProgramStructureInput,
  ): Promise<TrainingProgram>;
  activate(id: string): Promise<TrainingProgram>;
  cloneAsDraft(id: string): Promise<TrainingProgram>;
  complete(id: string): Promise<TrainingProgram>;
  archive(id: string): Promise<TrainingProgram>;
  /** Hard delete of a non-active program without recorded history. */
  delete(id: string): Promise<void>;
}
export type ProgramDeletionBlockReason = "active" | "history" | "not_found";
/** Nothing was deleted; the reason is explicit (ADR-0125). */
export class ProgramDeletionBlockedError extends Error {
  readonly reason: ProgramDeletionBlockReason;
  constructor(reason: ProgramDeletionBlockReason) {
    super(
      reason === "active"
        ? "O programa ativo não pode ser excluído. Arquive ou conclua o programa antes."
        : reason === "history"
          ? "Este programa tem treinos, decisões do Personal ou revisões registradas e não pode ser excluído, para preservar seu histórico. Você pode arquivá-lo."
          : "Programa não encontrado.",
    );
    this.name = "ProgramDeletionBlockedError";
    this.reason = reason;
  }
}
