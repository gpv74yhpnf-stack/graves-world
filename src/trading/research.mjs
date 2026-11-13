// Offline research only. Never import a brokerage client into this module.
function finitePositive(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(name + " must be positive and finite");
}
export function parseDailyCsv(csv) {
  if (typeof csv !== "string") throw new Error("CSV text is required");
  const lines = csv.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const headers = (lines.shift() || "").split(",").map(x => x.trim().toLowerCase());
  for (const required of ["date", "open", "close"]) {
    if (!headers.includes(required)) throw new Error("Missing CSV column: " + required);
  }
  const bars = lines.filter(line => line.trim()).map((line, i) => {
    const values = line.split(",").map(x => x.trim());
    if (values.length !== headers.length) throw new Error("Invalid CSV row " + (i + 2));
    const row = Object.fromEntries(headers.map((header, j) => [header, values[j]]));
    return { date: row.date, open: Number(row.open), close: Number(row.close) };
  });
  validateBars(bars);
  return bars;
}
export function validateBars(bars) {
  if (!Array.isArray(bars) || !bars.length) throw new Error("Daily price bars are required");
  let previous = "";
  for (const bar of bars) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bar.date) ||
        new Date(bar.date + "T00:00:00Z").toISOString().slice(0, 10) !== bar.date) {
      throw new Error("Invalid daily bar date");
    }
    if (bar.date <= previous) throw new Error("Bars must be unique and strictly date-ascending");
    finitePositive(bar.open, "open");
    finitePositive(bar.close, "close");
    previous = bar.date;
  }
}
function mean(items) {
  return items.reduce((sum, x) => sum + x, 0) / items.length;
}
function percent(value) {
  return Number((value * 100).toFixed(4));
}
export function backtest(bars, options = {}) {
  validateBars(bars);
  const fast = options.fast ?? 5;
  const slow = options.slow ?? 20;
  const initialCash = options.initialCash ?? 100000;
  const slippageBps = options.slippageBps ?? 5;
  const feeBps = options.feeBps ?? 1;
  if (!Number.isInteger(fast) || !Number.isInteger(slow) || fast < 1 || fast >= slow || slow >= bars.length) {
    throw new Error("Use 1 <= fast < slow < number of bars");
  }
  finitePositive(initialCash, "initialCash");
  for (const [key, value] of Object.entries({ slippageBps, feeBps })) {
    if (!Number.isFinite(value) || value < 0 || value > 500) throw new Error("Invalid " + key);
  }
  let cash = initialCash;
  let shares = 0;
  let pending = null;
  let peak = initialCash;
  let maxDrawdown = 0;
  const trades = [];
  const equityCurve = [];
  const closes = [];
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    // Only yesterday's close can create an order for today's open.
    if (pending === "buy" && shares === 0) {
      const fill = bar.open * (1 + slippageBps / 10000);
      const qty = Math.floor((cash * 0.90) / (fill * (1 + feeBps / 10000)));
      if (qty > 0) {
        cash -= qty * fill * (1 + feeBps / 10000);
        shares = qty;
        trades.push({ date: bar.date, side: "buy", qty, fill });
      }
    } else if (pending === "sell" && shares > 0) {
      const fill = bar.open * (1 - slippageBps / 10000);
      cash += shares * fill * (1 - feeBps / 10000);
      trades.push({ date: bar.date, side: "sell", qty: shares, fill });
      shares = 0;
    }
    const equity = cash + shares * bar.close;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak);
    equityCurve.push({ date: bar.date, equity: Number(equity.toFixed(2)) });
    closes.push(bar.close);
    pending = null;
    if (closes.length >= slow) {
      const quick = mean(closes.slice(-fast));
      const steady = mean(closes.slice(-slow));
      if (quick > steady && shares === 0) pending = "buy";
      if (quick < steady && shares > 0) pending = "sell";
    }
  }
  const finalEquity = cash + shares * bars.at(-1).close;
  return {
    parameters: { fast, slow, initialCash, slippageBps, feeBps },
    from: bars[0].date,
    through: bars.at(-1).date,
    finalEquity: Number(finalEquity.toFixed(2)),
    returnPct: percent(finalEquity / initialCash - 1),
    maxDrawdownPct: percent(maxDrawdown),
    tradeCount: trades.length,
    trades,
    equityCurve
  };
}
export function researchWalkForward(bars, options = {}) {
  validateBars(bars);
  const splitFraction = options.splitFraction ?? 0.7;
  if (!Number.isFinite(splitFraction) || splitFraction < 0.55 || splitFraction > 0.8) {
    throw new Error("splitFraction must be between 0.55 and 0.8");
  }
  const split = Math.floor(bars.length * splitFraction);
  const training = bars.slice(0, split);
  const holdout = bars.slice(split);
  const strategies = options.strategies ?? [
    { fast: 5, slow: 20 }, { fast: 8, slow: 30 },
    { fast: 10, slow: 40 }, { fast: 15, slow: 50 }
  ];
  if (training.length <= 51 || holdout.length <= 51) {
    throw new Error("Need enough daily bars for both training and unseen holdout (at least 52 each)");
  }
  if (!Array.isArray(strategies) || strategies.length < 1 || strategies.length > 50) {
    throw new Error("Provide between 1 and 50 strategies");
  }
  const ranked = strategies.map(strategy => {
    const train = backtest(training, { ...options, ...strategy });
    return {
      strategy,
      train,
      score: train.returnPct - 1.5 * train.maxDrawdownPct - 0.1 * train.tradeCount
    };
  }).sort((a, b) => b.score - a.score);
  const winner = ranked[0];
  // Selection uses only the training split. The holdout is evaluated exactly once.
  const test = backtest(holdout, { ...options, ...winner.strategy });
  return {
    mode: "offline-research",
    trainedThrough: training.at(-1).date,
    holdoutFrom: holdout[0].date,
    selectedStrategy: winner.strategy,
    candidatesTested: ranked.length,
    train: {
      returnPct: winner.train.returnPct,
      maxDrawdownPct: winner.train.maxDrawdownPct,
      tradeCount: winner.train.tradeCount
    },
    holdout: {
      returnPct: test.returnPct,
      maxDrawdownPct: test.maxDrawdownPct,
      tradeCount: test.tradeCount,
      finalEquity: test.finalEquity
    },
    warning: "Historical backtests are not predictive; holdout is an initial test, not proof of an edge."
  };
}
export function syntheticDemoBars(count = 320) {
  if (!Number.isInteger(count) || count < 110 || count > 1000) throw new Error("Invalid demo bar count");
  const bars = [];
  let date = new Date("2024-01-02T00:00:00Z");
  let close = 100;
  while (bars.length < count) {
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) {
      const open = close * (1 + Math.sin(bars.length * 1.73) * 0.007);
      close = open * (1 + 0.0003 + Math.sin(bars.length * 0.19) * 0.012);
      bars.push({
        date: date.toISOString().slice(0, 10),
        open: Number(open.toFixed(4)),
        close: Number(close.toFixed(4))
      });
    }
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return bars;
}