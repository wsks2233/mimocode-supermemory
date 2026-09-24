import test from "node:test";
import assert from "node:assert/strict";
import { extractHits } from "./.tmp/api.mjs";

test("extractHits prefers memory text then chunk forms", () => {
  const hits = extractHits({
    results: [
      { memory: { text: "from memory" }, similarity: 0.9 },
      { chunk: "from chunk string" },
      { chunk: { content: "from chunk content" }, id: "doc1", documents: [{ id: "doc1" }] },
      { memory: { text: "   " } },
    ],
  });
  assert.equal(hits.length, 3);
  assert.equal(hits[0].text, "from memory");
  assert.equal(hits[1].text, "from chunk string");
  assert.equal(hits[2].text, "from chunk content");
  assert.equal(hits[2].documentId, "doc1");
});

test("extractHits empty / no results", () => {
  assert.deepEqual(extractHits(null), []);
  assert.deepEqual(extractHits({ results: [] }), []);
});
