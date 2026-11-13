export async function readChatStream(response, onUpdate = () => {}) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "The local mind could not answer.");
  }
  if (!response.body?.getReader) throw new Error("This browser cannot read a live chat response.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let reply = "";
  let model = "local model";
  const acceptLine = line => {
    if (!line.trim()) return;
    let packet;
    try { packet = JSON.parse(line); }
    catch { throw new Error("The local mind sent an unreadable chat update."); }
    if (packet.error) throw new Error(String(packet.error).slice(0, 300));
    if (typeof packet.model === "string" && packet.model.length < 80) model = packet.model;
    if (typeof packet.token === "string" && reply.length < 5000) {
      reply += packet.token.slice(0, 5000 - reply.length);
      onUpdate(reply);
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value || new Uint8Array(), { stream: !done });
      let newline;
      while ((newline = pending.indexOf("\n")) >= 0) {
        acceptLine(pending.slice(0, newline).replace(/\r$/, ""));
        pending = pending.slice(newline + 1);
      }
      if (done) break;
    }
    if (pending.trim()) acceptLine(pending.replace(/\r$/, ""));
  } finally {
    reader.releaseLock();
  }
  if (!reply.trim()) throw new Error("The model returned an empty reply.");
  return { reply: reply.trim(), model };
}
