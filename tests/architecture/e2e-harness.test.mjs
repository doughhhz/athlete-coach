import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

// Cloud E2E harness (e2e/): structural checks of the Maestro workspace and
// of its coupling to the app (selectors, appId, secrets).
const root = resolve(import.meta.dirname, "../..");
const read = (path) => readFile(resolve(root, path), "utf8");
async function files(dir, pattern) {
  const found = [];
  for (const entry of await readdir(resolve(root, dir), {
    recursive: true,
    withFileTypes: true,
  }))
    if (entry.isFile() && pattern.test(entry.name))
      found.push(join(entry.parentPath, entry.name));
  return found;
}
const flowFiles = async () => [
  ...(await files("e2e/flows", /\.yaml$/)),
  ...(await files("e2e/subflows", /\.yaml$/)),
];

test("Maestro flows are well-formed: header, separator, spaces, command list", async () => {
  for (const path of await flowFiles()) {
    const text = await readFile(path, "utf8");
    assert.doesNotMatch(
      text,
      /\t/,
      `${path}: tabs are not valid YAML indentation`,
    );
    // Maestro on Windows reads flows as Latin-1: accented text never matches
    // (and assertNotVisible silently passes). Use ASCII and "." in regexes.
    assert.doesNotMatch(text, /[^\x00-\x7F]/, `${path}: non-ASCII character`);
    const [header, commands] = text.split(/^---$/m);
    assert.ok(commands, `${path}: missing --- between config and commands`);
    assert.match(header, /^appId: app\.athletecoach\.e2e$/m, `${path}: appId`);
    for (const line of commands
      .split("\n")
      .filter((l) => l.trim() && !l.trim().startsWith("#")))
      assert.match(
        line,
        /^(- |\s{2,}\S)/,
        `${path}: top-level lines must be list commands: ${line}`,
      );
  }
});

test("every Maestro id exists in the app and appId matches the E2E build", async () => {
  const config = await read("apps/mobile/app.config.ts");
  assert.match(config, /E2E_IOS_BUNDLE_IDENTIFIER = "app\.athletecoach\.e2e"/);
  const sources = await Promise.all(
    [
      ...(await files("apps/mobile/src", /\.tsx?$/)),
      ...(await files("apps/mobile/app", /\.tsx?$/)),
    ].map((path) => readFile(path, "utf8")),
  );
  const app = sources.join("\n");
  for (const path of await flowFiles()) {
    const text = await readFile(path, "utf8");
    for (const [, ids] of text.matchAll(/id: "([^"]+)"/g))
      for (const id of ids.split("|")) {
        const tab = id.match(/^tab-(\w+)$/);
        if (tab) {
          assert.match(app, /tabBarButtonTestID: `tab-\$\{tab\.route\}`/);
          assert.match(app, new RegExp(`route: "${tab[1]}"`), `${path}: ${id}`);
        } else
          assert.ok(
            app.includes(`"${id}"`),
            `${path}: selector ${id} has no testID in the app`,
          );
      }
  }
});

test("no credentials or keys in the E2E workspace and scripts", async () => {
  const paths = [
    ...(await flowFiles()),
    resolve(root, "e2e/config.yaml"),
    resolve(root, "e2e/README.md"),
    resolve(root, "scripts/run-maestro-cloud.ps1"),
    resolve(root, "scripts/e2e-cloud.ps1"),
    resolve(root, "apps/mobile/eas.json"),
  ];
  for (const path of paths) {
    const text = await readFile(path, "utf8");
    assert.doesNotMatch(
      text,
      /sb_(secret|publishable)_[A-Za-z0-9_]{8,}|eyJhbGciOi|AIza[0-9A-Za-z_-]{20,}|https:\/\/[a-z0-9]{20}\.supabase\.co/,
      path,
    );
    assert.doesNotMatch(
      text,
      // A literal value: quoted anywhere, or an unquoted YAML value.
      // Comparisons (===) and prompts (= Read-Host ...) are fine.
      /E2E_PASSWORD\s*[:=](?!=)\s*["'][^"'$]+["']|^\s*E2E_PASSWORD:\s*[^\s$"'{]/m,
      `${path}: literal password`,
    );
  }
  const flows = (
    await Promise.all((await flowFiles()).map((p) => readFile(p, "utf8")))
  ).join("\n");
  assert.match(flows, /inputText: \$\{E2E_EMAIL\}/);
  assert.match(flows, /inputText: \$\{E2E_PASSWORD\}/);
});

test("the E2E build profile is a standalone iOS simulator build", async () => {
  const eas = JSON.parse(await read("apps/mobile/eas.json"));
  const profile = eas.build["e2e-cloud"];
  assert.equal(profile.ios.simulator, true);
  assert.equal(profile.ios.buildConfiguration, "Release");
  assert.equal(profile.developmentClient, undefined, "no Metro dependency");
  assert.equal(profile.env.APP_VARIANT, "e2e");
  assert.equal(
    "EXPO_PUBLIC_SUPABASE_URL" in profile.env,
    false,
    "public config comes from EAS env vars",
  );
  const mobile = JSON.parse(await read("apps/mobile/package.json"));
  assert.equal(
    mobile.scripts["eas-build-pre-install"],
    "node scripts/assert-e2e-build-env.mjs",
  );
});
