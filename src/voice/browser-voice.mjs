/*
 * User-initiated browser voice helpers for the public/mobile town.
 * Speech recognition depends on browser support and may use the browser
 * vendor's transcription service. No always-on mic, no credential storage.
 */
export function describeVoiceSupport({ recognitionAvailable, speechAvailable }) {
  if (!recognitionAvailable && !speechAvailable) {
    return "Voice is unavailable in this browser. You can still type messages.";
  }
  if (!recognitionAvailable) {
    return "Spoken replies are available. Dictation isn't supported by this browser; type your message.";
  }
  if (!speechAvailable) {
    return "Voice dictation is available. Spoken replies aren't supported by this browser.";
  }
  return "Tap Dictate to speak a message, or turn on spoken replies. Nothing listens until you tap.";
}
export function appendDictation(existing, transcript, maxLength = 1800) {
  const combined = [String(existing ?? "").trim(), String(transcript ?? "").trim()].filter(Boolean).join(" ");
  return combined.slice(0, maxLength);
}
export function createBrowserVoiceController({
  browser = window,
  input,
  dictationButton,
  spokenRepliesButton,
  status,
  onStateChange = () => {}
}) {
  const Rec = browser.SpeechRecognition || browser.webkitSpeechRecognition;
  const synth = browser.speechSynthesis;
  const Utterance = browser.SpeechSynthesisUtterance;
  const recognitionAvailable = typeof Rec === "function";
  const speechAvailable = Boolean(synth && typeof synth.speak === "function" && typeof Utterance === "function");
  let listening = false;
  let spokenReplies = false;
  let recognition = null;
  let disposed = false;

  const setStatus = value => { if (status && !disposed) status.textContent = value; };
  const redraw = () => {
    if (dictationButton) {
      dictationButton.disabled = !recognitionAvailable;
      dictationButton.textContent = listening ? "⏹ Stop dictation" : "🎙 Dictate";
      dictationButton.setAttribute("aria-pressed", String(listening));
    }
    if (spokenRepliesButton) {
      spokenRepliesButton.disabled = !speechAvailable;
      spokenRepliesButton.textContent = spokenReplies ? "🔊 Spoken replies on" : "🔈 Spoken replies off";
      spokenRepliesButton.setAttribute("aria-pressed", String(spokenReplies));
    }
    onStateChange({ listening, spokenReplies });
  };
  const stopListening = () => {
    if (!recognition) return;
    try { recognition.stop(); } catch { /* can already be stopped */ }
    listening = false;
    redraw();
  };
  const onDictationClick = () => {
    if (!recognitionAvailable) { setStatus(describeVoiceSupport({ recognitionAvailable, speechAvailable })); return; }
    if (listening) { stopListening(); setStatus("Dictation stopped."); return; }
    try {
      recognition = new Rec();
      recognition.lang = browser.navigator?.language || "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = event => {
        const transcript = event?.results?.[0]?.[0]?.transcript;
        if (!transcript || !input) return;
        input.value = appendDictation(input.value, transcript, input.maxLength > 0 ? input.maxLength : 1800);
        setStatus("Dictation added to your draft. Review it, then tap Send.");
      };
      recognition.onerror = event => {
        setStatus("Dictation unavailable: " + String(event.error || "browser or microphone error") + ". You can type instead.");
      };
      recognition.onend = () => {
        listening = false;
        recognition = null;
        redraw();
      };
      recognition.start(); // always follows a user click
      listening = true;
      redraw();
      setStatus("Listening for one message. Tap Stop to finish.");
    } catch {
      listening = false;
      recognition = null;
      redraw();
      setStatus("Microphone could not start. Check browser permissions or type your message.");
    }
  };
  const speak = (value, { explicit = false } = {}) => {
    if (!speechAvailable || (!explicit && !spokenReplies) || disposed) {
      if (explicit && !speechAvailable) setStatus("This browser does not offer speech playback.");
      return false;
    }
    const text = String(value ?? "").trim().slice(0, 1100);
    if (!text) return false;
    try {
      synth.cancel();
      const utterance = new Utterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.96;
      utterance.pitch = 0.90;
      synth.speak(utterance);
      return true;
    } catch {
      setStatus("Audio playback was blocked by this device. Check volume and browser settings.");
      return false;
    }
  };
  const onSpokenClick = () => {
    if (!speechAvailable) { setStatus(describeVoiceSupport({ recognitionAvailable, speechAvailable })); return; }
    spokenReplies = !spokenReplies;
    if (!spokenReplies) synth.cancel();
    redraw();
    setStatus(spokenReplies ? "Spoken replies enabled for this tab." : "Spoken replies disabled.");
  };
  if (dictationButton) dictationButton.addEventListener("click", onDictationClick);
  if (spokenRepliesButton) spokenRepliesButton.addEventListener("click", onSpokenClick);
  setStatus(describeVoiceSupport({ recognitionAvailable, speechAvailable }));
  redraw();
  return {
    speak,
    stopListening,
    isSpokenRepliesEnabled: () => spokenReplies,
    destroy() {
      stopListening();
      disposed = true;
      try { synth?.cancel?.(); } catch {}
      dictationButton?.removeEventListener("click", onDictationClick);
      spokenRepliesButton?.removeEventListener("click", onSpokenClick);
    }
  };
}
