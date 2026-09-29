import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

// expo-router's <Link asChild> passes props through <Slot>, which rejects
// style arrays at runtime ("You are passing an array of styles to a child of
// <Slot>"). Direct children must receive a flattened style object.
const root = resolve(import.meta.dirname, "..");

test("children of <Link asChild> never receive a style array", async () => {
  const files = [];
  for (const dir of ["app", "src"])
    for (const entry of await readdir(resolve(root, dir), {
      recursive: true,
      withFileTypes: true,
    }))
      if (entry.isFile() && entry.name.endsWith(".tsx"))
        files.push(join(entry.parentPath, entry.name));
  for (const path of files) {
    const text = await readFile(path, "utf8");
    for (const match of text.matchAll(/asChild\s*>\s*<(\w+)([^>]*?)>/gs))
      assert.doesNotMatch(
        match[2],
        /style=\{\[/,
        `${path}: <${match[1]}> under <Link asChild> needs StyleSheet.flatten`,
      );
  }
});
