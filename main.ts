// Mean-reversion bot for cbBTC/USDC on 1-minute bars.
//
// Idea: on 1-minute bars the pool is noisy (a few bps a minute) while a full
// round trip costs about 35 bps, so chasing every wiggle bleeds money - the
// kit's fast EMA-cross baseline loses over $100 on the dev window doing
// exactly that. This bot instead trades only the slow oscillation of the
// price around its 4-hour average: it buys a dip below the average and
// sells once the price has swung to the other side of it. A trade aims for
// a ~1.6% round trip (0.6% down to enter, 1.0% up to exit), far above the
// ~0.35% cost, so it needs only a few trades a day. A wide stop and a
// maximum holding time cap the damage if the price trends away instead of
// reverting.
//
//   - Average: simple moving average of the last 240 closes (4 hours).
//   - Enter, full size: close below the average by 0.6% or more.
//   - Exit, whole position: close above the average by 1.0% or more.
//   - Exit, stop: the position worth under 97.5% of what it cost.
//   - Exit, stale: 240 bars (4 hours) after the entry bar.
//   - Orders fill at the next bar's open, so every decision uses the close
//     of the bar just sent; nothing here reads the clock or any randomness.
//
// One asset, long only, at most one open position. The bot keeps the
// average over every close it is sent, warm-up bars included, and sends no
// order while warming up or before the average has 240 closes.

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Closes in the moving average: 240 one-minute bars is 4 hours. */
const AVG_BARS = 240;
/** Enter when the close is this far under the average (0.6%). */
const DIP = 0.994;
/** Exit when the close is this far over the average (1.0%). */
const TARGET = 1.01;
/** Exit when the position is worth less than this share of its cost (2.5% loss). */
const STOP = 0.975;
/** Exit when this many bars have passed since the entry bar (4 hours). */
const MAX_HOLD_BARS = 240;
/** Slippage cap per order: 1% past the close it was decided on. */
const MAX_SLIPPAGE_BPS = 100;

/** The closes seen so far, in order, as numbers (raw price units). */
const closes: number[] = [];
/** The batch seq the current position was entered on, or null when flat. */
let entrySeq: number | null = null;

function average(): number | null {
  if (closes.length < AVG_BARS) return null;
  let sum = 0;
  for (let i = closes.length - AVG_BARS; i < closes.length; i++) sum += closes[i]!;
  return sum / AVG_BARS;
}

await runBars({
  onBatch(state: BarsState, batch) {
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) closes.push(Number(bar.c));
    }
    if (state.warmingUp) return [];
    const avg = average();
    if (avg === null) return [];
    const close = closes[closes.length - 1]!;
    const held = state.positions.get(SYMBOL);
    const orders: (BuyInput | SellInput)[] = [];
    if (held !== undefined) {
      const value = state.value(SYMBOL, held.qty);
      const stale = entrySeq !== null && state.seq - entrySeq >= MAX_HOLD_BARS;
      if (value * 1000n < held.cost * 975n || stale || close > avg * TARGET) {
        orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
        entrySeq = null;
      }
      return orders;
    }
    if (close < avg * DIP) {
      const cash = state.cash;
      if (cash >= BigInt(state.hello.fees.min_notional_quote_units)) {
        orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS });
        entrySeq = state.seq;
      }
    }
    return orders;
  },
});
