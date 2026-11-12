# Graves World: private ChatGPT connection v1

## Goal

Allow the Operator to connect their own ChatGPT account to the locally running Graves World workshop. All sign-in, credential storage, model requests and conversation initiation remain on the Operator's computer. The public GitHub Pages town is not an authentication host and never receives account credentials.

## Official integration

This implementation uses OpenAI's Sign in with ChatGPT open-source local integration and its official local SDK. The SDK is retrieved into the local GravesPrivateMind vendor folder. The SDK is not copied into this repository. Its own license and third-party notices remain with the retrieved checkout.

The current DevKit license is noncommercial and is limited to personal learning, experimentation and development without an intended or reasonably anticipated commercial application. Do not use this DevKit integration for a commercial Graves World product, client work or business operations without obtaining the necessary written rights from OpenAI. If the project becomes commercial, stop using this connector until a separate written permission or an independently authorized API integration is in place.

Official references:
- https://developers.openai.com/siwc/quickstart
- https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt
- https://github.com/openai/sign-in-with-chatgpt-devkit
- https://openai.com/policies/sign-in-with-chatgpt-terms/

## Local-only boundaries

- OAuth uses the official local SDK and a loopback callback on 127.0.0.1.
- Access and refresh tokens are held only by the trusted local Node process.
- On Windows, the SDK credential provider uses DPAPI CurrentUser with application-specific entropy. The encrypted SDK store lives under %LOCALAPPDATA%\GravesPrivateMind\chatgpt.
- The browser receives only safe session metadata, model names and completed response text. It never receives OAuth tokens.
- The local bridge remains bound to 127.0.0.1. Never bind it to 0.0.0.0 or expose port 8787.
- ChatGPT plan use is a separate consent from identity sign-in. A connected identity without the chatgpt.tokens.use.direct permission cannot make model requests.
- Usage is subject to account eligibility, model availability, usage limits and user-controlled app limits. The app must show the active provider and make disconnect available.
- Requests are user-initiated. Do not run background requests or let public visitors trigger requests against the Operator's plan.
- SIWC must only power Graves World functionality. Do not expose a general-purpose proxy or token relay.
- Conversations remain in the browser session unless the Operator explicitly saves a proposal. Do not silently upload private vault data or ChatGPT conversation history.
- The private bridge may receive public town state as untrusted context. Public visitor offerings must not become privileged instructions or private memory.

## Voice

The first voice layer uses browser speech recognition for microphone transcription and browser speech synthesis for spoken replies. Microphone use starts only after the Operator presses the microphone control. Browser speech recognition availability and audio handling vary by browser and operating system; show a clear notice and preserve typed chat as the fallback. Speech synthesis is controlled by an explicit speak-replies toggle.

This is not OpenAI Realtime voice. It is a push-to-talk transcription and text-response speech layer over the selected text model. Realtime audio can be evaluated separately later.

## Fallback

Ollama remains available as the local provider. If ChatGPT is disconnected, not entitled, out of usage, or unavailable, the Operator can switch back to the local model.

## Verification still required

- Install and build the official SDK on the target Windows machine.
- Verify DPAPI encryption/decryption using the current Windows user.
- Complete a real OAuth sign-in and verify whether plan-usage scope is granted to the account.
- Confirm model listing and one short user-initiated response.
- Confirm disconnect revokes/removes local credentials.
- Confirm browser microphone permission, transcription and speech playback.
- Confirm that the public site cannot access credentials or trigger an Operator's plan usage.
- Do not merge/deploy the integration until local smoke tests and review are complete.
