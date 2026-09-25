import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeGitRemote,
  sanitizeRepoName,
  getGeneratedProjectTag,
  getTags,
  sha12,
} from "./.tmp/tags.mjs";

test("normalizeGitRemote (official)", () => {
  const a = normalizeGitRemote("https://github.com/wsks2233/mimocode-supermemory.git");
  const b = normalizeGitRemote("git@github.com:wsks2233/mimocode-supermemory.git");
  assert.ok(a);
  assert.equal(a, b);
});

test("sanitizeRepoName (official)", () => {
  assert.equal(sanitizeRepoName("My-Project.Name"), "my_project_name");
});

test("generated project tag embeds official 16-hex identity", () => {
  const tag = getGeneratedProjectTag("/mnt/f/代码/mimocode-supermemory");
  assert.match(tag, /^repo_[a-z0-9_]+__[0-9a-f]{16}$/);
});

test("getTags returns personal/project read lists", () => {
  const g = getTags("/mnt/f/代码/mimocode-supermemory");
  assert.ok(g.canonical.length > 0);
  assert.ok(Array.isArray(g.personalReads) && g.personalReads.includes(g.canonical));
  assert.ok(Array.isArray(g.projectReads) && g.projectReads.includes(g.canonical));
  assert.equal(g.user, g.canonical);
});

test("sha12 helper remains 12 hex for keyword ids", () => {
  assert.match(sha12("abc"), /^[0-9a-f]{12}$/);
});
