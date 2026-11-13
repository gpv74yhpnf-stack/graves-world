# Graves Trading Laboratory v1: isolated research + Alpaca PAPER ONLY

Status: experimental feature branch. Nothing in this branch enables live orders, T4 orders, or automatic production deployment.

## Capabilities

- Offline daily-bar research using a training / untouched holdout split.
- Moving-average strategy candidates selected on the training sample only.
- Orders simulated at the NEXT session's open, with configurable costs and slippage.
- Experiment results written to a private local journal, outside the public repository.
- Read-only Alpaca account/status/positions/open-order checks.
- Historical Alpaca IEX daily bars, subject to account and feed availability.
- An opt-in hourly, read-only research loop that journals only when completed daily bars change.
- A narrowly constrained, optional PAPER buy-bracket order preview/submit path and paper-order cancellation.
- Local paper kill switch and a private equity-peak baseline.
- No live account API, futures execution adapter, options, short-selling, or leverage order path.

## Commands

Run from the repository root with Node.js 22 or later:

    node scripts/trading-lab.mjs demo
    node scripts/trading-lab.mjs research path/to/prices.csv

CSV columns must include date,open,close, ascending and unique, with YYYY-MM-DD dates.
The demo is SYNTHETIC data. Any gains shown by it are fictional and not trading evidence.
Research outcomes are not predictions.

Alpaca requires the PAPER key/secret configured as process environment variables.
On Windows PowerShell, use the paper dashboard and enter the credentials locally:

    $env:GRAVES_ALPACA_PAPER_KEY = Read-Host "Alpaca PAPER key"
    $paperSecret = Read-Host "Alpaca PAPER secret" -AsSecureString
    $env:GRAVES_ALPACA_PAPER_SECRET = [System.Net.NetworkCredential]::new("", $paperSecret).Password

Do NOT paste secrets into ChatGPT, Codex prompts, GitHub issues, source files, or screenshots.
Do not commit an .env file. These process-level variables are not permanently saved.
Close the terminal or clear them when finished.

    node scripts/trading-lab.mjs paper-status
    node scripts/trading-lab.mjs research-data SPY 2024-01-02 2025-12-31
    node scripts/trading-lab.mjs research-once SPY
    node scripts/trading-lab.mjs watch-data SPY
    node scripts/trading-lab.mjs paper-preview SPY 1 400 390 420

Research-once runs one completed-bar, deduplicated research cycle. Watch-data
rechecks at most once per hour while that terminal and PC remain running,
records only changed completed daily bars, and can be stopped with Ctrl+C.
It NEVER submits an order or runs in the background after the terminal closes.
Repeatedly viewing the same holdout results can itself cause overfitting;
this cycle's historical results must not be used as proof of live readiness.

The first paper-status call initializes a local peak-equity baseline.
Previews require the paper market to be open, a valid equity asset, cash, positions,
orders and a non-engaged kill switch. Prices above are examples, not current quotes.
Use market-informed prices before making a simulated submission.

To submit a simulated order, use the same arguments plus explicit confirmation:

    node scripts/trading-lab.mjs paper-submit SPY 1 400 390 420 --confirm-paper

The connector constructs a PAPER-only limit BUY BRACKET order, including both
stop-loss and take-profit legs. A rejection is safe and may reflect broker rules.
Stops are not guaranteed fills, and slippage/gaps may exceed intended risk.

To cancel a specific PAPER order (UUID only):

    node scripts/trading-lab.mjs paper-cancel ORDER_UUID --confirm-paper

To disable new Graves PAPER submissions:

    node scripts/trading-lab.mjs paper-kill

A kill switch does NOT cancel outstanding paper orders. Cancel them explicitly
through the broker or the paper-cancel command.

To re-enable paper-only submissions after reviewing the risk incident:

    node scripts/trading-lab.mjs paper-unlock --confirm-unlock

To clear credentials in that terminal:

    Remove-Item Env:GRAVES_ALPACA_PAPER_KEY
    Remove-Item Env:GRAVES_ALPACA_PAPER_SECRET

## Guardrails

The fixed policy in src/trading/risk.mjs restricts orders to active U.S. equities,
whole-share long-only buys, market-open sessions and account status ACTIVE.

Maximum proposed order: 5% of equity. Intended loss to stop: 0.5% of equity.
Projected per-symbol exposure: 10%; gross long exposure: 35%; at most 5 symbols;
retain 20% cash reserve. Block new orders when daily equity falls by 2% versus
the previous close or 10% below the locally recorded peak.

The policy is checked BEFORE a paper order POST and cannot be changed by a
strategy text response. It does not guarantee losses cannot exceed a threshold.
Changes to account state between the check and exchange fill, fills during market
gaps, delayed pricing and concurrent external orders can still defeat assumptions.
Never treat this as a production-grade live-trading risk gateway.

Private local artifacts are stored in:
- Windows: %LOCALAPPDATA%\GravesPrivateMind\trading
- Linux/macOS: ~/.graves-world/trading

The Windows vault bootstrap should be used first to configure local folder access
controls. This directory is not automatically encrypted at rest by this code.
No API key is saved in the journal. Paper-risk.json is the local equity baseline.

## Future development (not implemented)

1. Deterministic market-data snapshot/versioning and broader walk-forward folds.
2. A benchmark including dividend/split adjustment, realistic execution costs,
   and data-quality checks across multiple asset classes.
3. Robust local research service/scheduler with independent crash recovery and notifications.
4. Fill/rejection reconciliation, broker-side stops, account-wide monitoring,
   restart-safe order state, alerting and emergency order cancellation.
5. Read-only dashboard in the private workshop, with risk and test history.
6. Explicit promotion gate for strategy candidates; independent out-of-sample,
   forward and paper evidence, no automatic live promotion.

## T4/Plus500 Futures: research-only future adapter

Official Plus500 Futures Technologies documentation describes open .NET and FIX
APIs, T4 Desktop Simulator sample applications, and separate clearing-firm live
account requirements: https://pft.plus500.com/api

Do not assume retail Plus500 Futures mobile access gives API credentials.
Verify account permissions and documentation with Plus500/T4 before adding any
connector. Prototype using a T4 simulator-only account in an isolated process.
NO live T4 credentials, live order submission, or broker account linkage is
part of this feature branch.

## Test it

    npm test
    npm run validate:state

This MVP must not be treated as an autonomous profitable system. A successful
backtest, a paper fill, or a high synthetic return cannot establish a trading edge.
