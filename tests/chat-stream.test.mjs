import test from "node:test";
import assert from "node:assert/strict";
import { ReadableStream } from "node:stream/web";
import { readChatStream } from "../src/chat/ndjson-client.mjs";

function response(chunks, { status = 200, headers = { "content-type": "application/x-ndjson" } } = {}) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  }), { status, headers });
}

test("chat stream joins partial NDJSON frames and reports incremental text", async () => {
  const updates = [];
  const result = await readChatStream(response([
    '{"token":"Hello ","model":"qwen3.5:4b"}\n{"token":"lantern",',
    '"model":"qwen3.5:4b"}\n{"done":true,"model":"qwen3.5:4b"}\n'
  ]), text => updates.push(text));
  assert.deepEqual(result, { reply: "Hello lantern", model: "qwen3.5:4b" });
  assert.deepEqual(updates, ["Hello ", "Hello lantern"]);
});

test("chat stream surfaces bridge errors and refuses an empty reply", async () => {
  await assert.rejects(readChatStream(response(['{"error":"Model unavailable"}\n'])), /Model unavailable/);
  await assert.rejects(readChatStream(response(['{"done":true}\n'])), /empty reply/);
  const failed = new Response(JSON.stringify({ error: "Please start the local bridge." }), { status: 503 });
  await assert.rejects(readChatStream(failed), /Please start the local bridge/);
});
