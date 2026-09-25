import type { AppAccessState } from "./app-session";

export function getRouteAccess(state: AppAccessState) {
  return {
    auth: state === "signed_out",
    onboarding: state === "signed_in_onboarding_required",
    ready: state === "signed_in_ready",
  } as const;
}
