import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { backtest, parseDailyCsv, researchWalkForward, syntheticDemoBars } from "../src/trading/research.mjs";
import { inspectPaperBuy } from "../src/trading/risk.mjs";
import { createAlpacaPaperClient, PAPER_TRADING_ORIGIN } from "../src/trading/alpaca-paper.mjs";
import {
  appendResearchRecord, readRiskState, setPaperKillSwitch,
  updatePeakEquity, withPaperOrderLock
} from "../src/trading/private-ledger.mjs";

const account = {
  status: "ACTIVE", trading_blocked: false, account_blocked: false,
  cash: "100000", equity: "100000", last_equity: "100000"
};
const proposal = { symbol: "SPY", qty: 10, limitPrice: 100, stopPrice: 95, takeProfitPrice: 110 };
const asset = { class: "us_equity", symbol: "SPY", status: "active", tradable: true };
const riskState = { peakEquity: 100000, killSwitch: false };
const good = { account, proposal, asset, riskState, clock: { is_open: true }, positions: [], openOrders: [] };

test("CSV validation blocks unordered, duplicate, and invalid data", () => {
  assert.equal(parseDailyCsv("date,open,close\n2024-01-01,10,11\n2024-01-02,11,12\n").length, 2);
  assert.throws(() => parseDailyCsv("date,open,close\n2024-01-01,1,2\n2024-01-01,2,3"), /ascending/);
  assert.throws(() => parseDailyCsv("date,open,close\n2024-02-30,1,2"), /date/);
  assert.throws(() => parseDailyCsv("date,open,close\n2024-01-01,NaN,2"), /positive/);
});

test("backtest orders use the NEXT daily open, not the signal close", () => {
  const bars = syntheticDemoBars(320);
  const run = backtest(bars, { fast: 5, slow: 20 });
  for (const trade of run.trades) {
    const index = bars.findIndex(bar => bar.date === trade.date);
    assert.ok(index >= 20);
    const open = bars[index].open;
    assert.ok(Math.abs(trade.fill - open) / open < 0.001);
  }
  assert.ok(Number.isFinite(run.maxDrawdownPct));
});

test("changing unseen prices cannot change training selection", () => {
  const bars = syntheticDemoBars(320);
  const first = researchWalkForward(bars);
  const split = Math.floor(bars.length * 0.7);
  const changed = bars.map((bar, i) => i < split ? bar : {
    ...bar, open: bar.open * 1.5, close: bar.close * 0.5
  });
  const second = researchWalkForward(changed);
  assert.deepEqual(first.selectedStrategy, second.selectedStrategy);
  assert.deepEqual(first.train, second.train);
  assert.notDeepEqual(first.holdout, second.holdout);
});

test("risk gate allows a small bracketed paper buy, blocks excessive loss and leverage exposure", () => {
  assert.equal(inspectPaperBuy(good).allowed, true);
  const stopTooFar = inspectPaperBuy({ ...good, proposal: { ...proposal, qty: 30, stopPrice: 10 } });
  assert.equal(stopTooFar.allowed, false);
  assert.ok(stopTooFar.reasons.some(x => /stop distance/.test(x)));
  const drawdown = inspectPaperBuy({
    ...good, account: { ...account, equity: "75000" }
  });
  assert.equal(drawdown.allowed, false);
  assert.ok(drawdown.reasons.some(x => /drawdown/.test(x)));
  assert.equal(inspectPaperBuy({ ...good, riskState: { ...riskState, killSwitch: true } }).allowed, false);
  assert.equal(inspectPaperBuy({ ...good, positions: [{ symbol: "SPY", market_value: "-10", qty: "-1" }] }).allowed, false);
  assert.equal(inspectPaperBuy({ ...good, clock: { is_open: false } }).allowed, false);
  assert.equal(inspectPaperBuy({ ...good, asset: { ...asset, class: "crypto" } }).allowed, false);
});

test("Alpaca connector uses only paper and read-only market data hosts and requires confirmation", async () => {
  const calls = [];
  const json = data => new Response(JSON.stringify(data), { status: 200 });
  const client = createAlpacaPaperClient({
    key: "TEST-PAPER-KEY", secret: "TEST-PAPER-SECRET",
    fetchImpl: async (url, options) => {
      calls.push({ url, method: options.method, body: options.body });
      const path = new URL(url).pathname;
      if (path === "/v2/account") return json(account);
      if (path === "/v2/positions" || path === "/v2/orders") return json([]);
      if (path === "/v2/assets/SPY") return json(asset);
      if (path === "/v2/clock") return json({ is_open: true });
      if (path === "/v2/orders" && options.method === "POST") return json({ id: "paper-id", status: "new" });
      if (path === "/v2/stocks/SPY/bars") return json({ bars: [{
        t: "2024-01-02T05:00:00Z", o: 100, c: 101
      }] });
      throw new Error("unexpected request " + path);
    }
  });
  const preview = await client.guardedBuy({ proposal, riskState });
  assert.equal(preview.allowed, true);
  assert.equal(preview.submitted, false);
  assert.ok(calls.every(x => x.method === "GET"));
  const order = await client.guardedBuy({ proposal, riskState, confirmed: true });
  assert.equal(order.submitted, true);
  const post = calls.find(x => x.method === "POST");
  assert.ok(post.url.startsWith(PAPER_TRADING_ORIGIN));
  const body = JSON.parse(post.body);
  assert.equal(body.order_class, "bracket");
  assert.equal(body.side, "buy");
  assert.equal(body.stop_loss.stop_price, "95");
  assert.ok(calls.every(x =>
    x.url.startsWith("https://paper-api.alpaca.markets/") ||
    x.url.startsWith("https://data.alpaca.markets/")
  ));
  await client.getDailyBars("SPY", "2024-01-01", "2024-02-01");
  await assert.rejects(client.cancelPaperOrder("abc", true), /UUID/);
});

test("private ledger persists peak, kill switch, and refuses concurrent order execution", async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "graves-trading-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await assert.rejects(readRiskState(dir), /Run paper-status/);
  const first = await updatePeakEquity(100000, dir);
  assert.equal(first.peakEquity, 100000);
  await updatePeakEquity(95000, dir);
  assert.equal((await readRiskState(dir)).peakEquity, 100000);
  await setPaperKillSwitch(true, dir);
  assert.equal((await readRiskState(dir)).killSwitch, true);
  await appendResearchRecord({ source: "synthetic", result: 0 }, dir);
  assert.match(await readFile(path.join(dir, "experiments.jsonl"), "utf8"), /synthetic/);
  await withPaperOrderLock(async () => {
    await assert.rejects(withPaperOrderLock(async () => {}, dir), /EEXIST/);
  }, dir);
});
