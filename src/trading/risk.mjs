// Independent policy gate for Alpaca PAPER orders. No AI model may change this policy.
export const PAPER_LIMITS = Object.freeze({
  maxIntendedTradeLossFraction: 0.005,
  maxNewOrderFraction: 0.05,
  maxSymbolExposureFraction: 0.10,
  maxGrossExposureFraction: 0.35,
  minCashReserveFraction: 0.20,
  maxDailyLossFraction: 0.02,
  maxPeakDrawdownFraction: 0.10,
  maxSymbols: 5
});
function number(value) {
  if (value === "" || value === null || value === undefined) return NaN;
  return Number(value);
}
function positive(value) {
  return Number.isFinite(value) && value > 0;
}
export function inspectPaperBuy({ account, positions, openOrders, asset, clock, proposal, riskState }) {
  const reasons = [];
  const { symbol, qty, limitPrice, stopPrice, takeProfitPrice } = proposal ?? {};
  const equity = number(account?.equity);
  const cash = number(account?.cash);
  const lastEquity = number(account?.last_equity);
  const peak = number(riskState?.peakEquity);
  const quantity = number(qty);
  const entry = number(limitPrice);
  const stop = number(stopPrice);
  const target = number(takeProfitPrice);
  const validSymbol = typeof symbol === "string" && /^[A-Z][A-Z0-9.]{0,9}$/.test(symbol);
  if (!validSymbol) reasons.push("Symbol must be a normalized U.S. equity symbol");
  if (!Number.isSafeInteger(quantity) || quantity <= 0) reasons.push("Quantity must be a positive whole number");
  if (!positive(entry) || !positive(stop) || !positive(target) || !(stop < entry && entry < target)) {
    reasons.push("Require positive prices satisfying stop < limit < take profit");
  }
  if (account?.status !== "ACTIVE" || account?.trading_blocked === true || account?.account_blocked === true) {
    reasons.push("Account must be active and unblocked");
  }
  if (!clock || clock.is_open !== true) reasons.push("Paper market must be open for immediate submission");
  if (asset?.class !== "us_equity" || asset?.status !== "active" || asset?.tradable !== true ||
      asset?.symbol !== symbol) reasons.push("Asset must be an active, tradable U.S. equity");
  if (!positive(equity) || !Number.isFinite(cash) || cash < 0 || !positive(lastEquity)) {
    reasons.push("Valid account equity, cash, and previous-close equity required");
  }
  if (!positive(peak)) reasons.push("Missing private peak-equity baseline: run paper-status first");
  if (riskState?.killSwitch !== false) reasons.push("Trading is disabled by the local kill switch");
  if (!Array.isArray(positions) || !Array.isArray(openOrders)) {
    reasons.push("Both positions and open orders are required");
  }
  let existingExposure = 0;
  const symbols = new Set();
  let existingSymbolValue = 0;
  if (Array.isArray(positions)) {
    for (const item of positions) {
      const value = number(item.market_value);
      const holdingQty = number(item.qty);
      if (!Number.isFinite(value) || value < 0 || !Number.isFinite(holdingQty) || holdingQty < 0) {
        reasons.push("Short or invalid existing position prevents new paper buys");
        continue;
      }
      existingExposure += value;
      if (holdingQty > 0) symbols.add(item.symbol);
      if (item.symbol === symbol) existingSymbolValue += value;
    }
  }
  if (Array.isArray(openOrders)) {
    if (openOrders.length >= 100) reasons.push("Open-order list may be truncated; refusing submission");
    for (const item of openOrders) {
      if (item.side !== "buy") continue;
      const remaining = number(item.qty) - number(item.filled_qty ?? 0);
      const price = number(item.limit_price);
      if (!Number.isFinite(remaining) || remaining < 0 || !positive(price)) {
        reasons.push("Unknown open buy order exposure");
        continue;
      }
      const reserved = remaining * price;
      existingExposure += reserved;
      if (remaining > 0) symbols.add(item.symbol);
      if (item.symbol === symbol) existingSymbolValue += reserved;
    }
  }
  const notional = quantity * entry;
  const intendedLoss = quantity * (entry - stop);
  if (positive(equity) && positive(notional)) {
    if (notional > equity * PAPER_LIMITS.maxNewOrderFraction) reasons.push("New order exceeds 5% of equity");
    if (intendedLoss > equity * PAPER_LIMITS.maxIntendedTradeLossFraction) reasons.push("Planned stop distance exceeds 0.5% of equity");
    if (existingSymbolValue + notional > equity * PAPER_LIMITS.maxSymbolExposureFraction) reasons.push("Symbol exposure exceeds 10% of equity");
    if (existingExposure + notional > equity * PAPER_LIMITS.maxGrossExposureFraction) reasons.push("Total exposure exceeds 35% of equity");
    if (cash - notional < equity * PAPER_LIMITS.minCashReserveFraction) reasons.push("Cash reserve would fall below 20% of equity");
  }
  if (validSymbol && !symbols.has(symbol) && symbols.size >= PAPER_LIMITS.maxSymbols) reasons.push("Maximum five simultaneous symbols");
  if (positive(lastEquity) && positive(equity) &&
      (lastEquity - equity) / lastEquity >= PAPER_LIMITS.maxDailyLossFraction) {
    reasons.push("Daily loss shutdown threshold reached");
  }
  if (positive(peak) && positive(equity) &&
      (peak - equity) / peak >= PAPER_LIMITS.maxPeakDrawdownFraction) {
    reasons.push("Peak-to-current drawdown shutdown threshold reached");
  }
  return {
    allowed: reasons.length === 0,
    reasons,
    projectedNotional: Number.isFinite(notional) ? Number(notional.toFixed(2)) : null,
    intendedLossBeforeGaps: Number.isFinite(intendedLoss) ? Number(intendedLoss.toFixed(2)) : null
  };
}
