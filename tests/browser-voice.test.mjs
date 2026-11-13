import test from "node:test";
import assert from "node:assert/strict";
import {
  appendDictation, createBrowserVoiceController, describeVoiceSupport
} from "../src/voice/browser-voice.mjs";

class Button {
  constructor() { this.handlers = new Map(); this.attributes = {}; this.disabled = false; this.textContent = ""; }
  addEventListener(name, handler) { this.handlers.set(name, handler); }
  removeEventListener(name, handler) { if (this.handlers.get(name) === handler) this.handlers.delete(name); }
  setAttribute(key, value) { this.attributes[key] = value; }
  click() { this.handlers.get("click")?.(); }
}
class Recognition {
  static last;
  constructor() { Recognition.last = this; }
  start() { this.started = true; }
  stop() { this.stopped = true; this.onend?.(); }
}
class Utterance {
  constructor(text) { this.text = text; }
}

test("voice support is truthful and dictates only after a tap", () => {
  const mic = new Button(), toggle = new Button();
  const status = { textContent: "" }, input = { value: "", maxLength: 1800 };
  const speech = { spoken: [], cancel() {}, speak(u) { this.spoken.push(u.text); } };
  const voice = createBrowserVoiceController({
    browser: { SpeechRecognition: Recognition, SpeechSynthesisUtterance: Utterance, speechSynthesis: speech, navigator: { language: "en-US" } },
    input, dictationButton: mic, spokenRepliesButton: toggle, status
  });
  assert.match(status.textContent, /Tap Dictate/);
  assert.equal(Recognition.last, undefined);
  mic.click();
  assert.equal(Recognition.last.started, true);
  assert.equal(mic.attributes["aria-pressed"], "true");
  Recognition.last.onresult({ results: [[{ transcript: "Greetings Graves" }]] });
  assert.equal(input.value, "Greetings Graves");
  assert.match(status.textContent, /Review it/);
  Recognition.last.onend();
  assert.equal(mic.attributes["aria-pressed"], "false");
  assert.equal(voice.speak("Not enabled"), false);
  toggle.click();
  assert.equal(voice.isSpokenRepliesEnabled(), true);
  assert.equal(voice.speak("Voice is enabled"), true);
  assert.equal(speech.spoken[0], "Voice is enabled");
  toggle.click();
  assert.equal(voice.speak("Not speaking"), false);
  voice.destroy();
});

test("unsupported browser disables mic and offers typing without an exception", () => {
  const mic = new Button(), toggle = new Button();
  const status = { textContent: "" };
  const voice = createBrowserVoiceController({
    browser: {}, input: { value: "", maxLength: 1800 }, dictationButton: mic, spokenRepliesButton: toggle, status
  });
  assert.equal(mic.disabled, true);
  assert.equal(toggle.disabled, true);
  assert.match(status.textContent, /You can still type/);
  assert.equal(voice.speak("nothing", { explicit: true }), false);
  voice.destroy();
});

test("dictation appends safely and never auto-submits", () => {
  assert.equal(appendDictation("Hello", "Graves", 30), "Hello Graves");
  assert.equal(appendDictation("Hello", "Graves", 5), "Hello");
  assert.match(describeVoiceSupport({ recognitionAvailable: true, speechAvailable: false }), /dictation/i);
  assert.match(describeVoiceSupport({ recognitionAvailable: false, speechAvailable: true }), /Spoken replies/);
});
