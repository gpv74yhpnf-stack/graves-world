import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { appendResearchRecord, privateTradingDir } from "./private-ledger.mjs";
import { researchWalkForward } from "./research.mjs";

function newYorkDate(now) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(item => [item.type, item.value]));
  return values.year + "-" + values.month + "-" + values.day;
}
async function currentMarker(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
async function storeMarker(file, record) {
  const temp = file + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temp, JSON.stringify(record, null, 2), { flag: "wx", mode: 0o600 });
    await rename(temp, file);
  } finally {
    await unlink(temp).catch(error => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
/**
 * A bounded, opt-in research cycle. It does not place orders, retrain LLMs,
 * promote strategies, or access futures/live brokers.
 */
export async function runResearchCycle({
  client, symbol = "SPY", start = "2023-01-01",
  now = new Date(), storeDir = privateTradingDir()
}) {
  if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(symbol)) throw new Error("Invalid research symbol");
  const todayNewYork = newYorkDate(now);
  const received = await client.getDailyBars(symbol, start, todayNewYork);
  // Never use the in-progress market session's daily bar for research.
  const bars = received.filter(bar => bar.date < todayNewYork);
  if (bars.length < 180) throw new Error("Insufficient completed daily bars for a research cycle");
  const digest = createHash("sha256").update(JSON.stringify(bars)).digest("hex");
  await mkdir(storeDir, { recursive: true, mode: 0o700 });
  const markerFile = path.join(storeDir, symbol + "-research-state.json");
  const previous = await currentMarker(markerFile);
  if (previous?.digest === digest) {
    return { ran: false, reason: "No completed-bar changes", symbol, lastBar: bars.at(-1).date };
  }
  const report = researchWalkForward(bars);
  const summary = {
    event: "trading.research_cycle_completed",
    symbol,
    source: "ALPACA-IEX-COMPLETED-DAILY",
    digest,
    lastBar: bars.at(-1).date,
    report
  };
  await appendResearchRecord(summary, storeDir);
  await storeMarker(markerFile, { digest, lastBar: bars.at(-1).date, recordedAt: new Date().toISOString() });
  return { ran: true, symbol, lastBar: bars.at(-1).date, report };
}
