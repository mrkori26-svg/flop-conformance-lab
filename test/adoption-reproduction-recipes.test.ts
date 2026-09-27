import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Recipe = {
  consumer: string;
  pr: number;
  profile: string;
  workflow: string;
  evidence: string;
  prepare: [string, string[]][];
  build: [string, string[]];
};

test("external adoption reproduction recipes are declarative and unique", () => {
  const registry = JSON.parse(
    readFileSync(resolve(process.cwd(), "adoption", "reproduction-recipes.json"), "utf8")
  ) as { schema: string; recipes: Recipe[] };

  assert.equal(registry.schema, "flop.adoption-reproduction-recipes/v1");
  assert.ok(Array.isArray(registry.recipes));
  assert.ok(registry.recipes.length >= 2);  const ids = new Set<string>();
  for (const recipe of registry.recipes) {
    assert.match(recipe.consumer, /^[^/]+\/[^/]+$/);
    assert.ok(Number.isInteger(recipe.pr) && recipe.pr > 0);
    assert.ok(recipe.profile.length > 0);
    assert.ok(recipe.workflow.startsWith(".github/workflows/"));
    assert.ok(recipe.evidence.length > 0);
    assert.ok(Array.isArray(recipe.prepare));
    assert.equal(recipe.build.length, 2);
    const id = `${recipe.consumer}#${recipe.pr}`;
    assert.equal(ids.has(id), false);
    ids.add(id);
  }
});
