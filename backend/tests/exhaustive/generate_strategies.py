"""Generate 40+ synthetic but realistic backtest JSONs conforming to v1.0 schema.

Each generated backtest is internally consistent:
- trades sum (gross) approximately matches total return
- equity_curve is monotonically driven by the trade PnLs
- drawdown is computed from equity peaks
- win/loss counts match the trade list
- summary metrics match the actual underlying trades

Strategy variety:
- 4 instrument classes (equity, futures, options, crypto)
- 3 strategy types (long_only, long_short, short_only)
- 4 timeframes (5m, 1H, 1D, 1W)
- 3 market regimes (bull, bear, sideways)
- 3 sizes (tiny=10 trades, small=100, large=1000)

Outputs to backend/tests/exhaustive/strategies/<id>.json
"""
from __future__ import annotations

import hashlib
import json
import math
import random
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

random.seed(20260520)  # deterministic

OUT_DIR = Path(__file__).parent / "strategies"
OUT_DIR.mkdir(parents=True, exist_ok=True)

INSTRUMENT_SAMPLES = {
    "equity": ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS"],
    "futures": ["ES", "NQ", "CL", "MGC"],
    "options": ["NIFTY25OCT", "BANKNIFTY25OCT"],
    "crypto": ["BTC-USD", "ETH-USD", "SOL-USD"],
}
CURRENCIES = {
    "equity": "INR",
    "futures": "USD",
    "options": "INR",
    "crypto": "USD",
}
TIMEFRAMES = ["5m", "15m", "1H", "1D", "1W"]
REGIMES = ["bull", "bear", "sideways", "high_vol", "trend_then_chop"]
STRATEGY_TYPES = ["long_only", "long_short", "short_only", "market_neutral"]
EXECUTION = ["close_to_close", "next_open", "intrabar", "signal_close"]
FILLS = ["perfect", "partial", "market_impact"]
SIZING_METHODS = ["fixed_amount", "fixed_qty", "percent_notional", "percent_risk", "volatility_target"]


def regime_drift_vol(regime: str) -> tuple[float, float]:
    return {
        "bull":             ( 0.0008, 0.012),
        "bear":             (-0.0006, 0.014),
        "sideways":         ( 0.0001, 0.008),
        "high_vol":         ( 0.0003, 0.030),
        "trend_then_chop":  ( 0.0005, 0.015),
    }[regime]


def gen_trades(
    n: int,
    side_dist: dict[str, float],
    symbols: list[str],
    start: datetime,
    timeframe: str,
    win_rate: float,
    avg_winner_pct: float,
    avg_loser_pct: float,
    capital: float,
    instrument: str,
) -> list[dict]:
    """Generate n trades. Returns list conforming to schema's trades[]."""
    trades: list[dict] = []
    cur = start
    bars_per_trade_mean = {"5m": 3, "15m": 4, "1H": 6, "1D": 5, "1W": 4}[timeframe]
    minutes_per_bar = {"5m": 5, "15m": 15, "1H": 60, "1D": 1440, "1W": 10080}[timeframe]

    sides = random.choices(list(side_dist), weights=list(side_dist.values()), k=n)
    for i in range(n):
        is_winner = random.random() < win_rate
        side = sides[i]
        sym = random.choice(symbols)

        # Plausible entry price
        price = round(random.uniform(50, 2500), 2)
        qty = random.choice([1, 2, 5, 10, 50, 100, 200, 500])
        value = price * qty
        # Position value capped at 20% of capital
        if value > 0.2 * capital:
            qty = max(1, int((0.2 * capital) / price))
            value = price * qty

        # PnL distribution
        if is_winner:
            pct = random.gauss(avg_winner_pct, abs(avg_winner_pct) * 0.4)
        else:
            pct = random.gauss(avg_loser_pct, abs(avg_loser_pct) * 0.4)

        # For shorts, flip the sign of price movement direction
        # (PnL still goes to net = gross * sign-adjusted)
        gross = round(value * pct / 100.0, 2)
        fees = round(value * 0.0003 * 2, 2)  # ~3bps each side
        slippage = round(value * 0.0005, 2)
        taxes = round(value * 0.0001, 2) if instrument == "equity" else 0.0
        net = round(gross - fees - slippage - taxes, 2)
        net_pct = round(net / value * 100.0, 4) if value else 0.0

        bars = max(1, int(random.gauss(bars_per_trade_mean, 1.5)))
        entry_ts = cur
        exit_ts = cur + timedelta(minutes=minutes_per_bar * bars)

        exit_price = round(price * (1 + pct / 100.0 * (1 if side == "long" else -1)), 2)

        # Determine exit signal type
        signal_options = ["exit_signal", "stop_loss", "take_profit", "trailing_stop", "time_stop", "session_close"]
        if is_winner:
            sig_type = random.choices(["take_profit", "trailing_stop", "exit_signal"], weights=[4, 3, 3])[0]
        else:
            sig_type = random.choices(["stop_loss", "exit_signal", "time_stop"], weights=[6, 3, 1])[0]

        r_mult = round(net_pct / abs(avg_loser_pct), 2) if avg_loser_pct else 0.0
        mae = round(min(0.0, pct - random.uniform(0.5, 2.0)), 2)
        mfe = round(max(0.0, pct + random.uniform(0.5, 2.0)), 2)

        trades.append({
            "id": f"T-{i+1:04d}",
            "symbol": sym,
            "instrument_type": instrument,
            "side": side,
            "entry": {
                "timestamp": entry_ts.isoformat(),
                "price": price,
                "quantity": qty,
                "value": round(value, 2),
                "fees": round(fees / 2, 2),
                "slippage_bps": 5.0,
                "reason": f"signal_{random.choice(['ema_cross', 'rsi_oversold', 'breakout', 'pullback'])}",
                "signal_type": "entry_long" if side == "long" else "entry_short",
            },
            "exit": {
                "timestamp": exit_ts.isoformat(),
                "price": exit_price,
                "quantity": qty,
                "value": round(exit_price * qty, 2),
                "fees": round(fees / 2, 2),
                "slippage_bps": 5.0,
                "reason": sig_type,
                "signal_type": sig_type,
            },
            "pnl": {
                "gross": gross,
                "fees_total": fees,
                "slippage_total": slippage,
                "taxes_total": taxes,
                "net": net,
                "pct": net_pct,
                "r_multiple": r_mult,
            },
            "holding": {
                "bars": bars,
                "calendar_days": max(0, (exit_ts - entry_ts).days),
                "trading_days": max(0, bars // (1 if timeframe == "1D" else 6)),
            },
            "filters_at_entry": {
                "symbol": sym,
                "day_of_week": entry_ts.strftime("%a"),
                "month": entry_ts.strftime("%b"),
                "session": "regular",
            },
            "indicators_at_entry": {
                "rsi_14": round(random.uniform(20, 80), 1),
                "atr_14": round(price * 0.012, 2),
            },
            "mae_pct": mae,
            "mfe_pct": mfe,
            "tags": [],
            "notes": "",
        })

        # Advance to next trade with random spacing (some overlap implied via concurrency model)
        cur = exit_ts + timedelta(minutes=minutes_per_bar * random.randint(1, 8))

    return trades


def build_equity_and_drawdown(trades: list[dict], capital: float, date_from: date, date_to: date) -> tuple[list[dict], list[dict], dict]:
    """Build daily equity curve from trade PnLs. Returns (equity_curve, drawdown_curve, metrics_summary)."""
    # Tally PnL by date
    pnl_by_day: dict[str, float] = {}
    for t in trades:
        d = t["exit"]["timestamp"][:10]
        pnl_by_day[d] = pnl_by_day.get(d, 0.0) + t["pnl"]["net"]

    days: list[date] = []
    d = date_from
    while d <= date_to:
        days.append(d)
        d += timedelta(days=1)

    nav = 100.0
    equity_usd = capital
    equity_curve = []
    peak = nav
    drawdown_curve = []
    max_dd_pct = 0.0
    max_dd_peak_date = days[0].isoformat()
    max_dd_trough_date = days[0].isoformat()
    dd_start_idx = None
    longest_dd_days = 0
    current_peak = nav
    current_peak_date = days[0].isoformat()

    for d in days:
        delta_usd = pnl_by_day.get(d.isoformat(), 0.0)
        equity_usd += delta_usd
        new_nav = equity_usd / capital * 100.0
        nav = round(new_nav, 4)
        equity_curve.append({
            "date": d.isoformat(),
            "nav": nav,
        })

        if nav > peak:
            peak = nav
            current_peak = nav
            current_peak_date = d.isoformat()
        dd = round((nav - peak) / peak * 100.0, 4) if peak > 0 else 0.0
        drawdown_curve.append({"date": d.isoformat(), "drawdown_pct": dd, "underwater": dd < -0.0001})
        if dd < max_dd_pct:
            max_dd_pct = dd
            max_dd_peak_date = current_peak_date
            max_dd_trough_date = d.isoformat()

    # Compute headline metrics
    winners = [t for t in trades if t["pnl"]["net"] > 0]
    losers = [t for t in trades if t["pnl"]["net"] < 0]
    breakeven = [t for t in trades if t["pnl"]["net"] == 0]
    n = len(trades)
    sum_winners = sum(t["pnl"]["net"] for t in winners)
    sum_losers = sum(t["pnl"]["net"] for t in losers)
    profit_factor = round(sum_winners / abs(sum_losers), 4) if sum_losers else 99.99

    final_nav = equity_curve[-1]["nav"]
    total_return_pct = round(final_nav - 100.0, 4)
    years = max((date_to - date_from).days / 365.25, 1 / 365.25)
    cagr_pct = round((((final_nav / 100.0) ** (1 / years)) - 1) * 100.0, 4) if final_nav > 0 else -100.0

    # Sharpe / Sortino via daily returns
    daily_rets = []
    prev_nav = 100.0
    for p in equity_curve:
        daily_rets.append(p["nav"] / prev_nav - 1.0)
        prev_nav = p["nav"]
    daily_rets = daily_rets[1:]  # drop first which is 0
    if daily_rets:
        mean_r = sum(daily_rets) / len(daily_rets)
        var = sum((r - mean_r) ** 2 for r in daily_rets) / len(daily_rets)
        std = math.sqrt(var)
        sharpe = round((mean_r / std) * math.sqrt(252), 4) if std > 0 else 0.0
        downside_rets = [r for r in daily_rets if r < 0]
        if downside_rets:
            d_var = sum(r ** 2 for r in downside_rets) / len(downside_rets)
            d_std = math.sqrt(d_var)
            sortino = round((mean_r / d_std) * math.sqrt(252), 4) if d_std > 0 else 0.0
        else:
            sortino = 99.99
        vol = round(std * math.sqrt(252) * 100.0, 4)
    else:
        sharpe = sortino = vol = 0.0

    avg_trade_pct = round(sum(t["pnl"]["pct"] for t in trades) / n, 4) if n else 0.0
    win_rate_pct = round(len(winners) / n * 100.0, 4) if n else 0.0

    summary = {
        "total_return_pct": total_return_pct,
        "cagr_pct": cagr_pct,
        "sharpe": sharpe,
        "sortino": sortino,
        "max_drawdown_pct": max_dd_pct,
        "max_drawdown_peak_date": max_dd_peak_date,
        "max_drawdown_trough_date": max_dd_trough_date,
        "profit_factor": profit_factor,
        "expectancy_pct": avg_trade_pct,
        "win_rate_pct": win_rate_pct,
        "loss_rate_pct": round(100.0 - win_rate_pct, 4),
        "n_trades": n,
        "n_winners": len(winners),
        "n_losers": len(losers),
        "n_breakeven": len(breakeven),
        "avg_trade_pct": avg_trade_pct,
        "avg_winner_pct": round(sum(t["pnl"]["pct"] for t in winners) / len(winners), 4) if winners else 0.0,
        "avg_loser_pct": round(sum(t["pnl"]["pct"] for t in losers) / len(losers), 4) if losers else 0.0,
        "best_trade_pct": round(max((t["pnl"]["pct"] for t in trades), default=0.0), 4),
        "worst_trade_pct": round(min((t["pnl"]["pct"] for t in trades), default=0.0), 4),
        "largest_winner_amount": round(max((t["pnl"]["net"] for t in winners), default=0.0), 2),
        "largest_loser_amount": round(min((t["pnl"]["net"] for t in losers), default=0.0), 2),
        "exposure_time_pct": round(min(95.0, n * 0.5), 4),
    }
    return equity_curve, drawdown_curve, summary


def build_backtest(
    *,
    backtest_id: str,
    name: str,
    strategy_type: str,
    instrument: str,
    timeframe: str,
    regime: str,
    n_trades: int,
    capital: float = 1_000_000,
    win_rate: float = 0.52,
) -> dict:
    """Returns a schema-valid v1.0 backtest dict."""
    side_dist = {
        "long_only":      {"long": 1.0},
        "long_short":     {"long": 0.55, "short": 0.45},
        "short_only":     {"short": 1.0},
        "market_neutral": {"long": 0.5, "short": 0.5},
    }[strategy_type]

    # Date range derived from trade count + timeframe
    bars_per_year = {"5m": 78 * 252, "15m": 26 * 252, "1H": 6.5 * 252, "1D": 252, "1W": 52}[timeframe]
    target_years = max(0.5, min(5, n_trades / 200))
    date_to = date(2025, 12, 31)
    date_from = date_to - timedelta(days=int(target_years * 365))

    # winners/losers expectations
    drift, vol = regime_drift_vol(regime)
    avg_winner_pct = round(2.0 + vol * 100, 3)
    avg_loser_pct  = round(-1.5 - vol * 100, 3)

    symbols = INSTRUMENT_SAMPLES[instrument]
    start_dt = datetime.combine(date_from, datetime.min.time().replace(hour=9, minute=30), tzinfo=timezone.utc)
    trades = gen_trades(
        n=n_trades,
        side_dist=side_dist,
        symbols=symbols,
        start=start_dt,
        timeframe=timeframe,
        win_rate=win_rate,
        avg_winner_pct=avg_winner_pct,
        avg_loser_pct=avg_loser_pct,
        capital=capital,
        instrument=instrument,
    )

    equity_curve, drawdown_curve, summary = build_equity_and_drawdown(trades, capital, date_from, date_to)

    return {
        "schema_version": "1.0",
        "result_type": "backtest",
        "backtest_id": backtest_id,
        "source_system": {
            "name": "IFA synthetic test generator",
            "version": "1.0",
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "exporter": "exhaustive-test-suite",
        },
        "strategy": {
            "name": name,
            "version": "v1",
            "description": f"Synthetic {strategy_type} {instrument} strategy on {timeframe} in a {regime} regime.",
            "type": strategy_type,
            "instrument_type": instrument,
            "tags": [regime, timeframe, instrument],
        },
        "universe": {
            "name": f"{instrument} universe ({len(symbols)} symbols)",
            "symbols": symbols,
            "rebalance": "monthly",
            "market_data_provider": {"name": "Synthetic", "code": "SYN", "feed_type": "EOD"},
            "brokerage": {"name": "TestBroker", "account_type": "discount", "country": "IN" if instrument == "equity" else "US"},
        },
        "assumptions": {
            "date_range": {"from": date_from.isoformat(), "to": date_to.isoformat()},
            "initial_capital": {"amount": capital, "currency": CURRENCIES[instrument]},
            "timeframe": timeframe,
            "session": "regular",
            "execution": random.choice(EXECUTION),
            "fills": random.choice(FILLS),
            "shorting_allowed": strategy_type in ("long_short", "short_only", "market_neutral"),
            "brokerage": {"type": "percentage", "value_bps": 3.0, "applies_to": "both_sides"},
            "slippage":  {"type": "percentage", "value_bps": 5.0, "applies_to": "both_sides"},
            "position_sizing": {"method": random.choice(SIZING_METHODS), "value": 0.05, "max_concurrent_positions": 10},
            "leverage": 1.0,
            "rebalancing": "none",
            "data_source": "Synthetic test data",
            "currency": CURRENCIES[instrument],
            "warmup_bars": 200,
        },
        "metrics": {
            "summary": summary,
            "risk": {
                "volatility_pct_annualised": round(abs(summary["max_drawdown_pct"]) * 0.6, 4),
                "var_95_pct": round(summary["avg_loser_pct"], 4),
                "cvar_95_pct": round(summary["avg_loser_pct"] * 1.4, 4),
            },
        },
        "time_series": {
            "equity_curve": equity_curve,
            "drawdown_curve": drawdown_curve,
        },
        "trades": trades,
        "disclaimer": "Synthetic test data. Not investment advice.",
        "extras": {
            "regime": regime,
            "generator": "ifa-exhaustive-tests-v1",
        },
    }


def main() -> None:
    scenarios = []
    idx = 1

    # Coverage matrix
    for instrument in INSTRUMENT_SAMPLES:
        for strategy_type in STRATEGY_TYPES:
            # Short-only equity is rare in retail context, skip to save time
            if strategy_type == "short_only" and instrument == "equity":
                continue
            for timeframe in ["5m", "1H", "1D"]:
                for regime in ["bull", "bear", "sideways"]:
                    for size in [10, 100]:
                        code = f"BT-SYN-{idx:04d}"
                        name = f"{instrument.title()} {strategy_type} {timeframe} {regime} (n={size})"
                        scenarios.append({
                            "backtest_id": code,
                            "name": name,
                            "strategy_type": strategy_type,
                            "instrument": instrument,
                            "timeframe": timeframe,
                            "regime": regime,
                            "n_trades": size,
                        })
                        idx += 1

    # Plus a few extreme edge cases
    extras = [
        ("BT-SYN-EDGE-1trade",     1, "equity",  "long_only", "1D", "bull"),
        ("BT-SYN-EDGE-allwins",   30, "equity",  "long_only", "1D", "bull"),
        ("BT-SYN-EDGE-alllosses", 30, "equity",  "long_only", "1D", "bear"),
        ("BT-SYN-EDGE-large",   1000, "futures", "long_short", "5m", "trend_then_chop"),
        ("BT-SYN-EDGE-crypto-volatile", 200, "crypto", "long_short", "1H", "high_vol"),
    ]
    for code, n, instr, st, tf, reg in extras:
        scenarios.append({
            "backtest_id": code,
            "name": code,
            "strategy_type": st,
            "instrument": instr,
            "timeframe": tf,
            "regime": reg,
            "n_trades": n,
        })
        idx += 1

    print(f"Generating {len(scenarios)} synthetic backtests …")
    for s in scenarios:
        # all-wins / all-losses use forced win_rate
        win_rate = 0.52
        if "allwins" in s["backtest_id"]:
            win_rate = 1.0
        elif "alllosses" in s["backtest_id"]:
            win_rate = 0.0
        bt = build_backtest(
            backtest_id=s["backtest_id"],
            name=s["name"],
            strategy_type=s["strategy_type"],
            instrument=s["instrument"],
            timeframe=s["timeframe"],
            regime=s["regime"],
            n_trades=s["n_trades"],
            win_rate=win_rate,
        )
        out = OUT_DIR / f"{s['backtest_id']}.json"
        out.write_text(json.dumps(bt, default=str))
        print(f"  ✓ {s['backtest_id']:35s}  trades={len(bt['trades']):4d}  equity_points={len(bt['time_series']['equity_curve']):4d}")

    print(f"\nWrote {len(scenarios)} files to {OUT_DIR}")


if __name__ == "__main__":
    main()
