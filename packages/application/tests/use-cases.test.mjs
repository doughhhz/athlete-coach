import assert from "node:assert/strict";
import test from "node:test";

import {
  CompleteAthleteOnboarding,
  GetLatestBodyWeight,
  LoadCurrentAthleteProfile,
  RecordBodyWeight,
  SignOutCurrentSession,
  UpdateAthleteProfile,
} from "../src/index.ts";

const athlete = {
  id: "athlete-1",
  onboardingCompletedAt: "2026-09-25T12:00:00Z",
  userId: "user-1",
};

test("complete onboarding delegates one atomic payload", async () => {
  let received;
  const useCase = new CompleteAthleteOnboarding({
    async complete(input) {
      received = input;
      return athlete;
    },
  });
  const payload = { preferredName: "Atleta" };
  assert.equal(await useCase.execute(payload), athlete);
  assert.equal(received, payload);
});

test("loads the current profile snapshot from specific repositories", async () => {
  const profile = {
    athleteId: athlete.id,
    birthDate: "2000-01-01",
    heightCm: 180,
    preferredName: "Atleta",
    timezone: "America/Sao_Paulo",
  };
  const useCase = new LoadCurrentAthleteProfile(
    {
      async ensureCurrent() {
        return athlete;
      },
    },
    {
      async getCurrent() {
        return profile;
      },
      async updateCurrent() {
        return profile;
      },
    },
    {
      async getActive() {
        return null;
      },
      async changeActive() {
        throw new Error("unused");
      },
    },
    {
      async getCurrent() {
        return null;
      },
      async getAvailability() {
        return [1, 3, 5];
      },
      async setAvailability() {
        return [];
      },
      async updateCurrent() {
        throw new Error("unused");
      },
    },
    {
      async getLatest() {
        return null;
      },
      async record() {
        throw new Error("unused");
      },
    },
  );
  const snapshot = await useCase.execute();
  assert.equal(snapshot.profile, profile);
  assert.deepEqual(snapshot.availableWeekdays, [1, 3, 5]);
});

test("profile update returns the persisted record", async () => {
  const input = {
    birthDate: "2000-01-01",
    heightCm: 181,
    preferredName: "Novo nome",
    timezone: "America/Sao_Paulo",
  };
  const useCase = new UpdateAthleteProfile({
    async getCurrent() {
      return null;
    },
    async updateCurrent(received) {
      return { ...received, athleteId: athlete.id };
    },
  });
  assert.equal((await useCase.execute(input)).heightCm, 181);
});

test("record weight creates a new observation", async () => {
  const useCase = new RecordBodyWeight({
    async getLatest() {
      return null;
    },
    async record(input) {
      return {
        ...input,
        athleteId: athlete.id,
        id: "weight-2",
        source: "manual",
      };
    },
  });
  const result = await useCase.execute({
    measuredAt: "2026-09-25T12:00:00Z",
    weightKg: 77,
  });
  assert.equal(result.id, "weight-2");
});

test("latest weight query returns the latest persisted observation", async () => {
  const latest = {
    athleteId: athlete.id,
    id: "weight-latest",
    measuredAt: "2026-09-25T13:00:00Z",
    source: "manual",
    weightKg: 76.8,
  };
  const useCase = new GetLatestBodyWeight({
    async getLatest() {
      return latest;
    },
    async record() {
      throw new Error("unused");
    },
  });

  assert.equal(await useCase.execute(), latest);
});

test("sign out uses the session boundary", async () => {
  let signedOut = false;
  const useCase = new SignOutCurrentSession({
    async getSession() {
      return null;
    },
    onSessionChange() {
      return () => undefined;
    },
    async signIn() {
      throw new Error("unused");
    },
    async signUp() {
      throw new Error("unused");
    },
    async signOut() {
      signedOut = true;
    },
  });
  await useCase.execute();
  assert.equal(signedOut, true);
});
