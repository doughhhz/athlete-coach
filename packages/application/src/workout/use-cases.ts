import {
  assertWorkoutSetPerformance,
  canCompleteWorkout,
} from "@athlete-coach/domain";
import type { WorkoutSessionRepository } from "./ports.ts";
import {
  recordWorkoutSetInputSchema,
  type RecordWorkoutSetInput,
} from "./schemas.ts";
class WorkoutUseCase {
  protected readonly repository: WorkoutSessionRepository;
  constructor(repository: WorkoutSessionRepository) {
    this.repository = repository;
  }
}
export class StartWorkoutSession extends WorkoutUseCase {
  execute(trainingDayId: string) {
    return this.repository.start(trainingDayId);
  }
}
export class GetInProgressWorkoutSession extends WorkoutUseCase {
  execute() {
    return this.repository.getInProgress();
  }
}
export class GetWorkoutSession extends WorkoutUseCase {
  execute(id: string) {
    return this.repository.get(id);
  }
}
export class ListWorkoutSessions extends WorkoutUseCase {
  execute() {
    return this.repository.list();
  }
}
export class RecordWorkoutSet extends WorkoutUseCase {
  async execute(
    sessionId: string,
    setId: string,
    input: RecordWorkoutSetInput,
  ) {
    const session = await this.repository.get(sessionId);
    if (!session || session.status !== "in_progress")
      throw new Error("Treino em andamento não encontrado.");
    const set = session.exercises
      .flatMap((x) => x.sets)
      .find((x) => x.id === setId);
    if (!set) throw new Error("Série não encontrada.");
    const parsed = recordWorkoutSetInputSchema.parse(input);
    assertWorkoutSetPerformance(set.plannedMetric, parsed);
    return this.repository.recordSet(setId, parsed);
  }
}
export class SkipWorkoutSet extends WorkoutUseCase {
  execute(setId: string) {
    return this.repository.skipSet(setId);
  }
}
export class CompleteWorkoutSession extends WorkoutUseCase {
  async execute(id: string) {
    const session = await this.repository.get(id);
    if (!session || !canCompleteWorkout(session))
      throw new Error("Resolva todas as séries antes de finalizar.");
    return this.repository.complete(id);
  }
}
export class AbandonWorkoutSession extends WorkoutUseCase {
  execute(id: string) {
    return this.repository.abandon(id);
  }
}
