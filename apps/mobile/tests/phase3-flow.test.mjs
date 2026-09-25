import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getRouteAccess } from "../src/presentation/auth/route-access.ts";
import {
  nextOnboardingStep,
  onboardingLastStep,
} from "../src/presentation/onboarding/onboarding-flow.ts";

test("auth state exposes only its structural route group", () => {
  assert.deepEqual(getRouteAccess("signed_out"), {
    auth: true,
    onboarding: false,
    ready: false,
  });
  assert.deepEqual(getRouteAccess("signed_in_onboarding_required"), {
    auth: false,
    onboarding: true,
    ready: false,
  });
  assert.deepEqual(getRouteAccess("signed_in_ready"), {
    auth: false,
    onboarding: false,
    ready: true,
  });
});

test("invalid onboarding step cannot progress and review is the final step", () => {
  assert.equal(nextOnboardingStep(2, false), 2);
  assert.equal(nextOnboardingStep(2, true), 3);
  assert.equal(
    nextOnboardingStep(onboardingLastStep, true),
    onboardingLastStep,
  );
});

test("onboarding UI includes validation, review and completion", async () => {
  const source = await readFile(
    new URL(
      "../src/presentation/onboarding/onboarding-screen.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /safeParse/);
  assert.match(source, /Revise seus dados/);
  assert.match(source, /completeOnboarding/);
});

test("profile UI includes persisted edit, weight history and sign out actions", async () => {
  const source = await readFile(
    new URL("../src/presentation/profile/profile-screen.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /updateProfile/);
  assert.match(source, /recordWeight/);
  assert.match(source, /signOut/);
  assert.match(source, /Objetivo atual/);
  assert.match(source, /Dados do perfil indisponíveis/);
});

test("root session loading exposes a recoverable error state", async () => {
  const source = await readFile(
    new URL("../app/_layout.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Não foi possível carregar/);
  assert.match(source, /retryInitialization/);
});
