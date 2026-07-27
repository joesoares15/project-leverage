from __future__ import annotations

import argparse
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


SCORING_MODES = ("half", "ppr", "standard")
RB_RANGES = ((35, 60), (40, 60), (40, 72))
WR_RANGES = ((60, 90), (50, 80), (70, 100))
USABLE_FINISH = {"RB": 24, "WR": 36}


def first_existing(df: Any, names: list[str]) -> str | None:
    return next((name for name in names if name in df.columns), None)


def normalize_name(value: str | None) -> str:
    return "".join(ch.lower() for ch in (value or "") if ch.isalnum())


def fantasy_points(row: dict[str, Any], mode: str = "half") -> float:
    ppr = float(row.get("fantasy_points_ppr") or 0)
    standard = float(row.get("fantasy_points") or 0)
    receptions = float(row.get("receptions") or 0)
    if mode == "ppr":
        return ppr if ppr else standard + receptions
    if mode == "standard":
        return standard if standard else max(0.0, ppr - receptions)
    return standard + 0.5 * receptions if standard else ppr - 0.5 * receptions


def rate(rows: list[dict[str, Any]], predicate: Callable[[dict[str, Any]], bool]) -> dict[str, float | int]:
    selected = [row for row in rows if predicate(row)]
    return {
        "n": len(selected),
        "hit": sum(bool(row["hit"]) for row in selected) / (len(selected) or 1),
    }


def summarize(rows: list[dict[str, Any]], pos: str) -> dict[str, Any]:
    players_seen = {(r["season"], r["id"]) for r in rows}
    player_hits = {(r["season"], r["id"]) for r in rows if r["hit"]}
    counts: dict[tuple[int, str], int] = defaultdict(int)
    for row in rows:
        counts[(row["season"], row["id"])] += int(row["hit"])
    return {
        "pos": pos,
        "observations": len(rows),
        "players": len(players_seen),
        "hits": sum(int(r["hit"]) for r in rows),
        "hitRate": sum(int(r["hit"]) for r in rows) / (len(rows) or 1),
        "playerHitRate": len(player_hits) / (len(players_seen) or 1),
        "avgUsableWeeks": sum(counts.values()) / (len(counts) or 1),
        "workload": rate(rows, lambda r: r["workloadSignal"]),
        "injury": rate(rows, lambda r: r["injurySignal"]),
        "receiving": rate(rows, lambda r: r["receivingSignal"]),
        "combined": rate(rows, lambda r: r["combinedSignal"]),
        "neither": rate(rows, lambda r: not r["combinedSignal"]),
        "highDelta": rate(rows, lambda r: r["opportunityDelta"] >= 50),
        "lowDelta": rate(rows, lambda r: r["opportunityDelta"] < 50),
    }


def season_windows(seasons: list[int]) -> dict[str, list[int]]:
    windows = {f"{seasons[0]}-{seasons[-1]}": seasons}
    if len(seasons) >= 4:
        last4 = seasons[-4:]
        windows[f"{last4[0]}-{last4[-1]}"] = last4
    if len(seasons) >= 2:
        last2 = seasons[-2:]
        windows[f"{last2[0]}-{last2[-1]}"] = last2
    return windows


def build(seasons: list[int], output: Path) -> None:
    import nflreadpy as nfl
    import polars as pl

    needed = sorted({min(seasons) - 1, *seasons})
    stats = nfl.load_player_stats(needed, summary_level="week")
    if not isinstance(stats, pl.DataFrame):
        stats = pl.DataFrame(stats)

    position_col = first_existing(stats, ["position", "position_group"])
    team_col = first_existing(stats, ["recent_team", "team", "team_abbr"])
    id_col = first_existing(stats, ["player_id", "gsis_id"])
    name_col = first_existing(stats, ["player_display_name", "player_name"])
    carry_col = first_existing(stats, ["carries", "rushing_attempts"])
    target_col = first_existing(stats, ["targets"])
    required = [position_col, team_col, id_col, name_col, carry_col, target_col]
    if not all(required):
        raise RuntimeError(f"Unexpected player stats schema: {stats.columns}")

    stats = stats.filter(
        pl.col("season").is_in(needed)
        & pl.col("week").is_between(1, 18)
        & pl.col(position_col).is_in(["RB", "WR"])
    )

    players: dict[tuple[int, str, str], dict[str, Any]] = {}
    for row in stats.to_dicts():
        season = int(row["season"])
        pos = str(row[position_col])
        pid = str(row[id_col] or row[name_col])
        key = (season, pos, pid)
        player = players.setdefault(
            key,
            {
                "season": season,
                "pos": pos,
                "id": pid,
                "name": row[name_col] or pid,
                "team": row[team_col] or "",
                "weeks": [],
            },
        )
        carries = float(row.get(carry_col) or 0)
        targets = float(row.get(target_col) or 0)
        player["team"] = row.get(team_col) or player["team"]
        player["weeks"].append(
            {
                "week": int(row["week"]),
                "points": {mode: fantasy_points(row, mode) for mode in SCORING_MODES},
                "touches": carries + targets,
                "carries": carries,
                "targets": targets,
                "team": row.get(team_col) or player["team"],
            }
        )

    injury_frames: list[pl.DataFrame] = []
    injury_seasons: list[int] = []
    for season in seasons:
        try:
            frame = nfl.load_injuries(season)
            if not isinstance(frame, pl.DataFrame):
                frame = pl.DataFrame(frame)
            injury_frames.append(frame)
            injury_seasons.append(season)
        except Exception as exc:  # source availability varies by season
            print(f"Warning: injury data unavailable for {season}: {exc}")
    injuries = pl.concat(injury_frames, how="diagonal_relaxed") if injury_frames else pl.DataFrame()

    injuries_by_team_week: dict[tuple[int, int, str], list[dict[str, Any]]] = defaultdict(list)
    if injuries.height:
        ipos = first_existing(injuries, ["position"])
        iteam = first_existing(injuries, ["team"])
        iid = first_existing(injuries, ["gsis_id", "player_id"])
        iname = first_existing(injuries, ["full_name", "player_name"])
        if ipos and iteam:
            for row in injuries.to_dicts():
                if str(row.get(ipos) or "").upper() != "RB":
                    continue
                season, week = int(row.get("season") or 0), int(row.get("week") or 0)
                team = str(row.get(iteam) or "")
                if season not in seasons or not team or not 1 <= week <= 18:
                    continue
                status = str(row.get("report_status") or "").lower()
                practice = str(row.get("practice_status") or "").lower()
                unavailable = any(x in status for x in ["out", "doubtful", "reserve", "inactive"])
                uncertain = "questionable" in status or any(
                    x in practice for x in ["did not participate", "limited"]
                )
                if not unavailable and not uncertain:
                    continue
                name = str(row.get(iname) or "") if iname else ""
                rid = str(row.get(iid) or normalize_name(name)) if iid else normalize_name(name)
                injuries_by_team_week[(season, week, team)].append(
                    {
                        "id": rid,
                        "name": name or rid,
                        "status": status,
                        "practice": practice,
                        "unavailable": unavailable,
                    }
                )

    def teammate_prior_usage(season: int, week: int, team: str, injury: dict[str, Any]) -> float:
        best = 0.0
        for player in players.values():
            if player["season"] != season or player["pos"] != "RB" or player["team"] != team:
                continue
            if player["id"] != injury["id"] and normalize_name(player["name"]) != normalize_name(injury["name"]):
                continue
            previous = sorted(
                [w for w in player["weeks"] if w["week"] < week],
                key=lambda w: w["week"],
                reverse=True,
            )[:3]
            if previous:
                best = max(best, sum(w["touches"] for w in previous) / len(previous))
        return best

    prior_rank: dict[str, dict[tuple[int, str, str], int]] = {mode: {} for mode in SCORING_MODES}
    weekly_rank: dict[str, dict[tuple[int, int, str, str], int]] = {mode: {} for mode in SCORING_MODES}

    for mode in SCORING_MODES:
        for season in seasons:
            for pos in ("RB", "WR"):
                cohort = sorted(
                    [p for p in players.values() if p["season"] == season - 1 and p["pos"] == pos],
                    key=lambda p: sum(w["points"][mode] for w in p["weeks"]),
                    reverse=True,
                )
                for rank, player in enumerate(cohort, 1):
                    prior_rank[mode][(season, pos, player["id"])] = rank

            for week in range(1, 19):
                for pos in ("RB", "WR"):
                    entries: list[tuple[str, float]] = []
                    for player in players.values():
                        if player["season"] != season or player["pos"] != pos:
                            continue
                        current = next((w for w in player["weeks"] if w["week"] == week), None)
                        if current:
                            entries.append((player["id"], current["points"][mode]))
                    entries.sort(key=lambda item: item[1], reverse=True)
                    for rank, (pid, _) in enumerate(entries, 1):
                        weekly_rank[mode][(season, week, pos, pid)] = rank

    studies: dict[str, Any] = {}
    windows = season_windows(seasons)
    for mode in SCORING_MODES:
        base_observations: dict[str, list[dict[str, Any]]] = {"RB": [], "WR": []}
        for player in players.values():
            if player["season"] not in seasons:
                continue
            prior_position_rank = prior_rank[mode].get((player["season"], player["pos"], player["id"]))
            if not prior_position_rank:
                continue
            max_rank = 72 if player["pos"] == "RB" else 100
            if prior_position_rank > max_rank:
                continue
            weeks = sorted(player["weeks"], key=lambda w: w["week"])
            for current in weeks:
                previous = [w for w in weeks if w["week"] < current["week"]]
                last3 = previous[-3:]
                avg3 = sum(w["touches"] for w in last3) / len(last3) if last3 else 0.0
                target_avg3 = sum(w["targets"] for w in last3) / len(last3) if last3 else 0.0
                last = previous[-1]["touches"] if previous else 0.0
                rank = weekly_rank[mode].get(
                    (player["season"], current["week"], player["pos"], player["id"]), 999
                )
                vacated = 0.0
                injury_names: list[str] = []
                if player["pos"] == "RB":
                    injuries_this_week = injuries_by_team_week.get(
                        (player["season"], current["week"], current["team"]), []
                    )
                    for injury in injuries_this_week:
                        if injury["id"] == player["id"] or normalize_name(injury["name"]) == normalize_name(player["name"]):
                            continue
                        usage = teammate_prior_usage(player["season"], current["week"], current["team"], injury)
                        weighted = usage * (1.0 if injury["unavailable"] else 0.35)
                        vacated += weighted
                        if weighted >= 2:
                            injury_names.append(f"{injury['name']} ({injury['status'] or injury['practice']})")
                workload_signal = last >= 10 or avg3 >= 8
                injury_signal = vacated >= 6
                receiving_signal = target_avg3 >= 3
                delta = min(
                    100,
                    round(
                        min(30, avg3 * 2)
                        + min(12, max(0, last - avg3) * 3)
                        + min(35, vacated * 3)
                        + min(12, target_avg3 * 3)
                        + (10 if injury_signal and workload_signal else 0)
                    ),
                )
                base_observations[player["pos"]].append(
                    {
                        "season": player["season"],
                        "week": current["week"],
                        "id": player["id"],
                        "name": player["name"],
                        "team": current["team"],
                        "priorRank": prior_position_rank,
                        "fp": current["points"][mode],
                        "weekRank": rank,
                        "hit": rank <= USABLE_FINISH[player["pos"]],
                        "last": last,
                        "avg3": avg3,
                        "targetAvg3": target_avg3,
                        "vacated": vacated,
                        "injuryNames": injury_names,
                        "workloadSignal": workload_signal,
                        "injurySignal": injury_signal,
                        "receivingSignal": receiving_signal,
                        "combinedSignal": workload_signal or injury_signal or receiving_signal,
                        "opportunityDelta": delta,
                    }
                )

        for window_name, window_seasons in windows.items():
            for rb_lo, rb_hi in RB_RANGES:
                rb_rows = [
                    row
                    for row in base_observations["RB"]
                    if row["season"] in window_seasons and rb_lo <= row["priorRank"] <= rb_hi
                ]
                for wr_lo, wr_hi in WR_RANGES:
                    wr_rows = [
                        row
                        for row in base_observations["WR"]
                        if row["season"] in window_seasons and wr_lo <= row["priorRank"] <= wr_hi
                    ]
                    examples = sorted(
                        [row for row in rb_rows if row["injurySignal"]],
                        key=lambda row: (row["opportunityDelta"], row["fp"]),
                        reverse=True,
                    )[:12]
                    key = f"{window_name}|{mode}|{rb_lo}-{rb_hi}|{wr_lo}-{wr_hi}"
                    studies[key] = {
                        "RB": summarize(rb_rows, "RB"),
                        "WR": summarize(wr_rows, "WR"),
                        "examples": examples,
                    }

    payload = {
        "metadata": {
            "built_at": datetime.now(timezone.utc).isoformat(),
            "source": "nflverse via nflreadpy",
            "injury_seasons": injury_seasons,
            "methodology_version": "0.2.0",
            "default_study": f"{seasons[0]}-{seasons[-1]}|half|35-60|60-90",
            "assumptions": [
                "Cohorts use prior-season positional fantasy finish, not historical preseason ADP.",
                "RB24+ and WR36+ are generic usable-week thresholds.",
                "Opportunity Delta is a transparent descriptive rules score, not a calibrated forecast.",
                "Only information available before the target week's kickoff is used in opportunity signals.",
            ],
        },
        "available": {
            "season_windows": list(windows.keys()),
            "scoring": list(SCORING_MODES),
            "rb_ranges": [f"{lo}-{hi}" for lo, hi in RB_RANGES],
            "wr_ranges": [f"{lo}-{hi}" for lo, hi in WR_RANGES],
        },
        "studies": studies,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {output} ({output.stat().st_size / 1024:.1f} KiB; {len(studies)} study configurations)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--seasons", default="2019-2024")
    parser.add_argument("--output", default="site/data/anyrbona53.json")
    args = parser.parse_args()
    start, end = map(int, args.seasons.split("-"))
    build(list(range(start, end + 1)), Path(args.output))
