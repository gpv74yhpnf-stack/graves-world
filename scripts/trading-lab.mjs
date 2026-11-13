#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createAlpacaPaperClient } from "../src/trading/alpaca-paper.mjs";
import { parseDailyCsv, researchWalkForward, syntheticDemoBars } from "../src/trading/research.mjs";
import {
  appendResearchRecord, readRiskState, setPaperKillSwitch,
  updatePeakEquity, withPaperOrderLock
} from "../src/trading/private-ledger.mjs";

function help() {
  console.log([
    "GRAVES TRADING LAB: PAPER-ONLY",
    "  node scripts/trading-lab.mjs demo",
    "  node scripts/trading-lab.mjs research <daily-bars.csv>",
    "  node scripts/trading-lab.mjs research-data <SYMBOL> <START-YYYY-MM-DD> <END-YYYY-MM-DD>",
    "  node scripts/trading-lab.mjs paper-status",
    "  node scripts/trading-lab.mjs paper-preview <SYMBOL> <QTY> <LIMIT> <STOP> <TAKE-PROFIT>",
    "  node scripts/trading-lab.mjs paper-submit <SYMBOL> <QTY> <LIMIT> <STOP> <TAKE-PROFIT> --confirm-paper",
    "  node scripts/trading-lab.mjs paper-cancel <ORDER-UUID> --confirm-paper",
    "  node scripts/trading-lab.mjs paper-kill",
    "  node scripts/trading-lab.mjs paper-unlock --confirm-unlock",
    "",
    "Set GRAVES_ALPACA_PAPER_KEY and GRAVES_ALPACA_PAPER_SECRET in your local process environment.",
    "There is no live-trading endpoint or live order command."
  ].join("\n"));
}
async function researchAndRecord(bars, source) {
  const report = researchWalkForward(bars);
  await appendResearchRecord({ source, ...report });
  console.log(JSON.stringify({ source, ...report }, null, 2));
}
function proposalFrom(args) {
  if (args.length < 5) throw new Error("Expected SYMBOL QTY LIMIT STOP TAKE-PROFIT");
  return {
    symbol: args[0].toUpperCase(),
    qty: Number(args[1]),
    limitPrice: Number(args[2]),
    stopPrice: Number(args[3]),
    takeProfitPrice: Number(args[4])
  };
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help") return help();
  if (command === "demo") {
    await researchAndRecord(syntheticDemoBars(), "SYNTHETIC-DEMO-NOT-MARKET-DATA");
    return;
  }
  if (command === "research") {
    if (args.length !== 1) throw new Error("Supply one local CSV file path");
    const csv = await readFile(args[0], "utf8");
    await researchAndRecord(parseDailyCsv(csv), "USER-SUPPLIED-DAILY-CSV");
    return;
  }
  if (command === "paper-kill") {
    console.log("Paper-order kill switch engaged:", (await setPaperKillSwitch(true)).killSwitch);
    console.log("This blocks new Graves submissions. Existing open paper orders must be canceled separately.");
    return;
  }
  if (command === "paper-unlock") {
    if (!args.includes("--confirm-unlock")) throw new Error("Explicit --confirm-unlock required");
    console.log("Paper-only kill switch disengaged:", !(await setPaperKillSwitch(false)).killSwitch);
    return;
  }
  // All commands below require local PAPER API credentials, never passed on the CLI.
  const client = createAlpacaPaperClient();
  if (command === "paper-status") {
    const account = await client.getAccount();
    const state = await updatePeakEquity(account.equity);
    const positions = await client.getPositions();
    const orders = await client.getOpenOrders();
    console.log(JSON.stringify({
      environment: "Alpaca PAPER ONLY",
      accountStatus: account.status,
      equity: account.equity,
      cash: account.cash,
      lastEquity: account.last_equity,
      peakEquitySinceFirstCheck: state.peakEquity,
      killSwitch: state.killSwitch,
      positionCount: positions.length,
      openOrderCount: orders.length
    }, null, 2));
    return;
  }
  if (command === "research-data") {
    if (args.length !== 3) throw new Error("Expected SYMBOL START-DATE END-DATE");
    const [symbol, start, end] = args;
    const bars = await client.getDailyBars(symbol.toUpperCase(), start, end);
    await researchAndRecord(bars, "ALPACA-IEX-DAILY-" + symbol.toUpperCase());
    return;
  }
  if (command === "paper-preview" || command === "paper-submit") {
    const proposal = proposalFrom(args);
    const confirmed = command === "paper-submit" && args.includes("--confirm-paper");
    if (command === "paper-submit" && !confirmed) throw new Error("Explicit --confirm-paper required");
    await withPaperOrderLock(async () => {
      // Read a trusted local risk state. A model response cannot supply or change it.
      let riskState = await readRiskState();
      const account = await client.getAccount();
      riskState = await updatePeakEquity(account.equity);
      const result = await client.guardedBuy({ proposal, riskState, confirmed });
      console.log(JSON.stringify({ environment: "Alpaca PAPER ONLY", proposal, ...result }, null, 2));
      if (result.submitted) {
        await appendResearchRecord({
          event: "alpaca.paper_order_submitted", proposal,
          orderId: result.orderId, orderStatus: result.orderStatus
        });
      }
      if (confirmed && !result.allowed) process.exitCode = 2;
    });
    return;
  }
  if (command === "paper-cancel") {
    if (args.length !== 2 || args[1] !== "--confirm-paper") {
      throw new Error("Expected ORDER-UUID --confirm-paper");
    }
    const canceled = await client.cancelPaperOrder(args[0], true);
    await appendResearchRecord({ event: "alpaca.paper_order_canceled", orderId: args[0] });
    console.log(JSON.stringify({ environment: "Alpaca PAPER ONLY", canceled: true, response: canceled }));
    return;
  }
  throw new Error("Unknown command. Run with --help");
}
main().catch(error => {
  console.error("Trading Lab: " + error.message);
  process.exitCode = 1;
});
