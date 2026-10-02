import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appConfigUrl = new URL("../app.json", import.meta.url);
const tabsLayoutUrl = new URL("../app/(tabs)/_layout.tsx", import.meta.url);

// Design decision 2026-10-01 (ADR-0120): the app is dark only; it used to
// follow the system scheme ("automatic").
test("Expo config is dark only and keeps Expo Router and fonts", async () => {
  const config = JSON.parse(await readFile(appConfigUrl, "utf8"));

  assert.equal(config.expo.userInterfaceStyle, "dark");
  assert.ok(config.expo.plugins.includes("expo-router"));
  assert.ok(config.expo.plugins.includes("expo-font"));
});

test("tab shell declares the five Phase 1 routes", async () => {
  const layout = await readFile(tabsLayoutUrl, "utf8");
  const routeDefinitions = await readFile(
    new URL("../src/presentation/navigation/tabs.ts", import.meta.url),
    "utf8",
  );

  assert.match(layout, /tabDefinitions\.map/);
  for (const route of [
    "index",
    "treino",
    "nutricao",
    "progresso",
    "personal",
  ]) {
    assert.match(routeDefinitions, new RegExp(`route: ["']${route}["']`));
  }
});
