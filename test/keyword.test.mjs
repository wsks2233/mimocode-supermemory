import test from "node:test";
import assert from "node:assert/strict";
import { matchKeyword, extractRememberContent } from "./.tmp/keyword.mjs";

test("matchKeyword hits remember and Chinese", () => {
  assert.ok(matchKeyword("Please remember this project uses bun"));
  assert.ok(matchKeyword("记住部署窗口是周四"));
  assert.equal(matchKeyword("hello world only"), null);
  assert.equal(matchKeyword(""), null);
});

test("extractRememberContent strips trigger prefix", () => {
  assert.equal(extractRememberContent("Remember: staging is Thursday"), "staging is Thursday");
  assert.equal(extractRememberContent("记住：发布用 OIDC"), "发布用 OIDC");
  assert.equal(extractRememberContent("Don't forget to rotate keys"), "to rotate keys");
});
