# BTC Mean-Reversion Bot

[![make.fun](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603) [![rank](https://make.fun/badge/btc-race-24h-20261117-0603/jhw1106/btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603) [![reward](https://make.fun/badge/btc-race-24h-20261117-0603/jhw1106/btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603)

A trading bot for the make.fun "Race a BTC trading bot live for 24 hours"
competition. It trades Coinbase Wrapped BTC (cbBTC) against USDC on
1-minute bars, long only, starting from 1,000 USDC of paper money.

## Strategy

On 1-minute bars the price is noisy (a few basis points a minute) while a
full round trip costs about 35 bps in fees, slippage and price impact, so
chasing every wiggle loses money. This bot trades only the slow oscillation
of the price around its 4-hour moving average:

- **Enter, full size:** the close falls 0.6% or more below the 240-bar
  simple moving average of closes.
- **Exit, whole position:** the close rises 1.0% or more above that average.
- **Exit, stop:** the position is worth under 97.5% of what it cost.
- **Exit, stale:** 240 bars (4 hours) after the entry bar.

A trade aims for a ~1.6% round trip against ~0.35% of costs, so it needs
only a few trades a day. Orders fill at the next bar's open; every decision
uses the close of the bar just sent. The bot reads no clock and uses no
randomness, so two runs agree exactly.

## Layout

- `main.ts` — the bot (Node 22, TypeScript with type stripping).
- `vendor/makefun-bars.ts` — the kit's `agent-fun/bars-replay/v1` shim,
  copied byte for byte.
- `LICENSE` — MIT.
