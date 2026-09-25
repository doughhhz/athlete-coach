import { spawnSync } from "node:child_process";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const outputPath = resolve(
  repositoryRoot,
  "packages/data-access/src/generated/database.types.ts",
);
const temporaryPath = `${outputPath}.tmp`;
const localTemporaryDirectory = resolve(
  repositoryRoot,
  ".cache/supabase-cli-temp",
);
const supabaseCliPath = resolve(
  repositoryRoot,
  "node_modules/supabase/dist/supabase.js",
);

await mkdir(localTemporaryDirectory, { recursive: true });

const result = spawnSync(
  process.execPath,
  [
    supabaseCliPath,
    "gen",
    "types",
    "typescript",
    "--local",
    "--schema",
    "public",
  ],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      TEMP: localTemporaryDirectory,
      TMP: localTemporaryDirectory,
    },
    shell: false,
  },
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.stderr.write(result.stderr || "Supabase type generation failed.\n");
  process.exit(result.status || 1);
}

await mkdir(dirname(outputPath), { recursive: true });
const generatedTypes = `${result.stdout.trimEnd()}\n`;
await writeFile(temporaryPath, generatedTypes, "utf8");
await rm(outputPath, { force: true });
await rename(temporaryPath, outputPath);

process.stdout.write(`Generated ${outputPath}\n`);
