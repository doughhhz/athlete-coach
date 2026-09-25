import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const presentationRoots = [
  resolve(repositoryRoot, "apps/mobile/app"),
  resolve(repositoryRoot, "apps/mobile/src/presentation"),
];

test("presentation does not access Supabase directly", async () => {
  for (const root of presentationRoots) {
    for (const file of await listSourceFiles(root)) {
      const source = await readFile(file, "utf8");

      assert.doesNotMatch(
        source,
        /@supabase\//,
        `${file} imports Supabase directly`,
      );
      assert.doesNotMatch(
        source,
        /@athlete-coach\/data-access/,
        `${file} imports data access directly`,
      );
      assert.doesNotMatch(
        source,
        /\.from\s*\(/,
        `${file} performs a direct data query`,
      );
    }
  }

  for (const file of await listSourceFiles(presentationRoots[1])) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(
      source,
      /@\/infrastructure/,
      `${file} imports concrete infrastructure`,
    );
  }
});

test("domain and application dependencies continue pointing inward", async () => {
  const domainFiles = await listSourceFiles(
    resolve(repositoryRoot, "packages/domain/src"),
  );
  const applicationFiles = await listSourceFiles(
    resolve(repositoryRoot, "packages/application/src"),
  );

  for (const file of domainFiles) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(
      source,
      /(?:from|import)\s*[({]?\s*["'](?:react|expo|@supabase\/|@athlete-coach\/)/i,
    );
  }

  for (const file of applicationFiles) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /@supabase\/|@athlete-coach\/data-access/);
  }
});

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(path)));
    } else if ([".ts", ".tsx"].includes(extname(entry.name))) {
      files.push(path);
    }
  }

  return files;
}
