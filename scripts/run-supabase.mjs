import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const localTemporaryDirectory = resolve(
  repositoryRoot,
  ".cache/supabase-cli-temp",
);
const supabaseCliPath = resolve(
  repositoryRoot,
  "node_modules/supabase/dist/supabase.js",
);

mkdirSync(localTemporaryDirectory, { recursive: true });

const result = spawnSync(
  process.execPath,
  [supabaseCliPath, ...process.argv.slice(2)],
  {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      TEMP: localTemporaryDirectory,
      TMP: localTemporaryDirectory,
    },
    stdio: "inherit",
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
