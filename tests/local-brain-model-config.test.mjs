import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const MODEL = "hf.co/mradermacher/DeepSeek-V4-Pro-Qwen3.5-9B-UNCENSORED-heretic-i1-GGUF:Q4_K_M";

test("local bridge and Windows launcher default to the selected Ollama model", async () => {
  const [server, launcher] = await Promise.all([
    readFile(new URL("../local-brain/server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../local-brain/start.ps1", import.meta.url), "utf8")
  ]);
  assert.ok(server.includes(`process.env.OLLAMA_MODEL||'${MODEL}'`));
  assert.ok(launcher.includes(`$env:OLLAMA_MODEL = "${MODEL}"`));
});
