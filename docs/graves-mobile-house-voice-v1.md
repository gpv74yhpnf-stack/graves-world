# Graves World Mobile: Lantern Hearth and private voice (v1)

This feature adds a first physical **Graves' House** to the 3D town, a linked
house panel, a 2D fallback card, optional device speech playback, tap-to-dictate
messages, and an optional private HTTPS connection to an existing local Graves
Ollama bridge.

## What's public and what isn't

Public GitHub Pages includes the house and the **Speak with Graves** interface.
Anyone can visit the house and tap **Hear his latest thought**. That audio comes
from already-published town state, spoken by their own browser. It is not a
generated AI response.

The mobile mic helps dictate a message into the chat draft (when the browser
supports Web Speech). It does **not** record in the background or auto-send.
Browser vendors may process speech recognition remotely. Transcription results
are editable and only sent if the visitor explicitly taps Send.

**Live generated AI replies are NOT provided by the static GitHub Pages site.**
Those require the separately running, authenticated private bridge reachable
from the phone. This build cannot work as a public multi-user chat service
without a separately designed server-side auth, abuse controls, and hosting.

Browsers with no microphone or speech synthesis support keep the text interface.

## Connect your own phone to your own Graves brain

Recommended option: **Tailscale Serve**, which proxies a loopback-only server
to devices signed into your private tailnet. Do NOT use Tailscale Funnel:
Funnel exposes the service publicly. Merely ending a URL in *.ts.net does not
prove that it is private; verify your Serve configuration.

1. On the Windows PC, start your installed Ollama model and local Graves bridge:
   \`powershell -ExecutionPolicy Bypass -File .\local-brain\start.ps1\`
   The bridge must be listening at 127.0.0.1:8787. If that port is occupied by
   another Graves instance, identify it before starting a second one.

2. Install and sign in to **Tailscale** on both PC and phone with the same
   tailnet identity. Set access controls so only your authorized devices/users
   can reach the PC service.

3. On the PC, ensure Tailscale Serve HTTPS is enabled. In PowerShell run:
   \`tailscale serve --bg 8787\`
   Then run \`tailscale serve status\`. Note the
   \`https://your-computer.your-tailnet.ts.net\` URL it prints. **Confirm
   Tailscale Funnel is OFF** with \`tailscale funnel status\`.
   The PC and local brain must remain running for replies to work.
   (Tailscale may prompt you to enable HTTPS certificates.)

4. In your phone browser, confirm Tailscale is connected. Open the public
   Graves World URL, tap **Talk**, and paste only the private HTTPS origin
   (no path, token or secret) into **Private brain connection**. Tap Connect.

5. When the status indicates connected, tap **Dictate** to transcribe one
   message, review/edit it, then tap Send. Tap **Spoken replies off** to opt
   into spoken AI replies. You can also type without using a microphone.

6. In the travel menu, select **Graves' House** and tap
   **Hear his latest thought**. This also works without a private bridge.

To disable the proxy on PC: \`tailscale serve off\`.
To disconnect a phone's configured bridge, tap **Use local** in the chat panel.
Never use Funnel, expose 8787 on the internet, paste brokerage/API credentials,
or configure an unknown web service as the private brain.

## Limitations

- The house is an exterior 3D structure with a visit panel, not yet a walkable
  furnished interior.
- Browser speech depends on permissions and platform support, especially on iOS.
- Mobile AI access via Tailscale requires setup by the device owner and should
  be validated on the actual phone before calling it working.
- The local bridge uses existing CORS origin restrictions. A real public hosted
  voice service needs independent authentication and rate limiting.
- Audio may require a user gesture to start on mobile.
- The Tailscale URL validator deliberately accepts only HTTPS *.ts.net origins
  or local loopback. It cannot tell Serve and Funnel apart, so verify the
  Tailscale CLI status and private access controls.
- The public website and this code do not create a phone-accessible public
  version of the private memory vault or GPT account features.

## Documentation

Official Tailscale Serve examples and CLI:
- https://tailscale.com/docs/reference/examples/serve
- https://tailscale.com/docs/reference/tailscale-cli/serve
- https://tailscale.com/docs/features/tailscale-serve

## Validation

\`npm test\` and \`npm run validate:state\` on the branch. The mobile UI still
needs hands-on browser/WebGL and private tailnet connectivity tests.
