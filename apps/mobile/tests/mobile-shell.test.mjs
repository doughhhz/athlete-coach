import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appConfigUrl = new URL("../app.json", import.meta.url);
const tabsLayoutUrl = new URL("../app/(tabs)/_layout.tsx", import.meta.url);

test("Expo config keeps automatic color scheme and Expo Router", async () => {
  const config = JSON.parse(await readFile(appConfigUrl, "utf8"));

  assert.equal(config.expo.userInterfaceStyle, "automatic");
  assert.ok(config.expo.plugins.includes("expo-router"));
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
