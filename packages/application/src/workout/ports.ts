import type {
  WorkoutSession,
  WorkoutSessionSummary,
} from "@athlete-coach/domain";
import type { RecordWorkoutSetInput } from "./schemas.ts";
export interface WorkoutSessionRepository {
  start(trainingDayId: string): Promise<WorkoutSession>;
  getInProgress(): Promise<WorkoutSession | null>;
  get(id: string): Promise<WorkoutSession | null>;
  list(): Promise<readonly WorkoutSessionSummary[]>;
  recordSet(
    setId: string,
    input: RecordWorkoutSetInput,
  ): Promise<WorkoutSession>;
  skipSet(setId: string): Promise<WorkoutSession>;
  complete(sessionId: string): Promise<WorkoutSession>;
  abandon(sessionId: string): Promise<WorkoutSession>;
}
