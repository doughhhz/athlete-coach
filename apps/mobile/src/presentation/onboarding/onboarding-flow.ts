export const onboardingLastStep = 7;

export function nextOnboardingStep(
  currentStep: number,
  currentStepIsValid: boolean,
): number {
  if (!currentStepIsValid) return currentStep;
  return Math.min(onboardingLastStep, currentStep + 1);
}
