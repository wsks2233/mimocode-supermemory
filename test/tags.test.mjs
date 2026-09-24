import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeOrigin,
  sha12,
  containerTagSync,
  safeName,
  resolveContainerTag,
} from "./.tmp/tags.mjs";

test("normalizeOrigin strips protocol, .git, git@ ssh", () => {
  const a = normalizeOrigin("https://github.com/wsks2233/mimocode-supermemory.git");
  const b = normalizeOrigin("git@github.com:wsks2233/mimocode-supermemory.git");
  const c = normalizeOrigin("https://github.com/wsks2233/mimocode-supermemory");
  assert.equal(a, "github.com/wsks2233/mimocode-supermemory");
  assert.equal(a, b);
  assert.equal(a, c);
});

test("sha12 of normalized official origin is c3d35c834ba4", () => {
  const h = sha12(normalizeOrigin("https://github.com/wsks2233/mimocode-supermemory.git"));
  assert.equal(h, "c3d35c834ba4");
});

test("safeName and containerTagSync basename local fallback", () => {
  assert.equal(safeName("C:\\\\wsks\\\\mimocode-supermemory-test"), "mimocode-supermemory-test");
  const tag = containerTagSync("C:\\wsks\\my-project", {});
  assert.equal(tag, "repo_my-project__local");
  const bad = containerTagSync("C:\\wsks\\~~", {});
  assert.match(bad, /^repo_path_[0-9a-f]+__local$/);
});

test("resolveContainerTag uses projectContainerTag pin", async () => {
  const info = await resolveContainerTag("C:\\wsks\\any-dir", {
    projectContainerTag: "pin_test_tag",
  });
  assert.equal(info.source, "config:projectContainerTag");
  assert.equal(info.canonical, "pin_test_tag");
});

test("resolveContainerTag no pin + no git uses basename-or-path", async () => {
  const info = await resolveContainerTag("C:\\wsks\\not-a-repo-dir", {});
  assert.equal(info.source, "basename-or-path");
  assert.match(info.canonical, /^repo_not-a-repo-dir__local$|^repo_path_/);
});
