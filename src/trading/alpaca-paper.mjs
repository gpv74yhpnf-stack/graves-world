import { randomUUID } from "node:crypto";
import { inspectPaperBuy } from "./risk.mjs";

export const PAPER_TRADING_ORIGIN = "https://paper-api.alpaca.markets";
const MARKET_DATA_ORIGIN = "https://data.alpaca.markets";

function symbolOrThrow(symbol) {
  if (typeof symbol !== "string" || !/^[A-Z][A-Z0-9.]{0,9}$/.test(symbol)) {
    throw new Error("Expected a normalized U.S. equity ticker");
  }
  return symbol;
}
function dateOrThrow(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date) {
    throw new Error("Expected YYYY-MM-DD");
  }
  return date;
}
export function createAlpacaPaperClient({
  key = process.env.GRAVES_ALPACA_PAPER_KEY,
  secret = process.env.GRAVES_ALPACA_PAPER_SECRET,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!key || !secret) throw new Error("Set GRAVES_ALPACA_PAPER_KEY and GRAVES_ALPACA_PAPER_SECRET locally");
  if (typeof fetchImpl !== "function") throw new Error("Fetch must be available");

  async function request(origin, method, pathname, body) {
    const response = await fetchImpl(origin + pathname, {
      method,
      headers: {
        "APCA-API-KEY-ID": key,
        "APCA-API-SECRET-KEY": secret,
        "accept": "application/json",
        ...(body ? { "content-type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error("Alpaca " + (origin === PAPER_TRADING_ORIGIN ? "paper" : "market-data") +
      " request failed with HTTP " + response.status);
    if (response.status === 204) return null;
    return response.json();
  }
  async function getAccount() {
    return request(PAPER_TRADING_ORIGIN, "GET", "/v2/account");
  }
  async function getPositions() {
    return request(PAPER_TRADING_ORIGIN, "GET", "/v2/positions");
  }
  async function getOpenOrders() {
    return request(PAPER_TRADING_ORIGIN, "GET", "/v2/orders?status=open&limit=100&nested=false");
  }
  async function getClock() {
    return request(PAPER_TRADING_ORIGIN, "GET", "/v2/clock");
  }
  async function getAsset(symbol) {
    return request(PAPER_TRADING_ORIGIN, "GET", "/v2/assets/" + symbolOrThrow(symbol));
  }
  async function getDailyBars(symbol, start, end) {
    symbolOrThrow(symbol);
    dateOrThrow(start);
    dateOrThrow(end);
    if (start >= end) throw new Error("End date must be after start date");
    const query = new URLSearchParams({
      timeframe: "1Day", start, end, limit: "10000", feed: "iex", adjustment: "raw"
    });
    const response = await request(MARKET_DATA_ORIGIN, "GET",
      "/v2/stocks/" + symbol + "/bars?" + query.toString());
    if (response.next_page_token) throw new Error("Historical bars are paginated; narrow the date range");
    const bars = response.bars ?? [];
    return bars.map(bar => ({
      date: String(bar.t).slice(0, 10),
      open: Number(bar.o),
      close: Number(bar.c)
    }));
  }
  async function guardedBuy({ proposal, riskState, confirmed = false }) {
    symbolOrThrow(proposal?.symbol);
    const [account, positions, openOrders, asset, clock] = await Promise.all([
      getAccount(), getPositions(), getOpenOrders(), getAsset(proposal.symbol), getClock()
    ]);
    const evaluation = inspectPaperBuy({
      account, positions, openOrders, asset, clock, proposal, riskState
    });
    if (!confirmed || !evaluation.allowed) return { ...evaluation, submitted: false };
    const order = await request(PAPER_TRADING_ORIGIN, "POST", "/v2/orders", {
      symbol: proposal.symbol,
      qty: String(proposal.qty),
      side: "buy",
      type: "limit",
      time_in_force: "day",
      limit_price: String(proposal.limitPrice),
      order_class: "bracket",
      take_profit: { limit_price: String(proposal.takeProfitPrice) },
      stop_loss: { stop_price: String(proposal.stopPrice) },
      extended_hours: false,
      client_order_id: "graves-paper-" + randomUUID()
    });
    return { ...evaluation, submitted: true, orderId: order.id, orderStatus: order.status };
  }
  async function cancelPaperOrder(id, confirmed = false) {
    if (!confirmed) throw new Error("Explicit cancellation confirmation required");
    if (typeof id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error("Expected a valid paper-order UUID");
    }
    return request(PAPER_TRADING_ORIGIN, "DELETE", "/v2/orders/" + id);
  }
  return Object.freeze({
    getAccount, getPositions, getOpenOrders, getClock, getAsset, getDailyBars,
    guardedBuy, cancelPaperOrder
  });
}
