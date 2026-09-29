// Authoritative analysis record as returned by CoachAnalysisRepository (ADR-0078).
export const ANALYSIS_REQUEST_ID = "00000000-0000-4000-8000-0000000000ab";
export function analysisRecord(analysis, program, change = {}) {
  return {
    analysisRequestId: ANALYSIS_REQUEST_ID,
    analysis,
    trainingAdviceBlocked: analysis.safetyFlags.some(
      (flag) => flag.blocksTrainingAdvice,
    ),
    sourceProgram: program
      ? { id: program.id, revision: program.revision }
      : null,
    createdAt: "2026-10-02T00:00:00.000Z",
    ...change,
  };
}
