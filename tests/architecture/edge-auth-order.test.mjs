import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const functions = ["coach-analyze", "coach-propose", "coach-decide"];

// ADR-0073: authenticate before disclosing any provider or service-role
// configuration state. Only SUPABASE_URL/SUPABASE_ANON_KEY (required to verify
// the JWT at all) may be checked before auth.getUser().
for (const name of functions)
  test(`${name} authenticates before checking provider/service configuration`, async () => {
    const source = await readFile(
      resolve(root, `supabase/functions/${name}/index.ts`),
      "utf8",
    );
    const auth = source.indexOf("auth.getUser()");
    assert.ok(auth > 0, "function must authenticate the caller");
    for (const pattern of [/!apiKey\)/, /!service\b/, /!service \|\|/]) {
      const match = source.search(pattern);
      if (match >= 0)
        assert.ok(
          match > auth,
          `${name}: ${pattern} is evaluated before authentication`,
        );
    }
    const preAuth = source.slice(0, auth);
    assert.doesNotMatch(
      preAuth,
      /GEMINI_API_KEY\s*\)\s*;?\s*\n?\s*if \(!apiKey/,
    );
  });
