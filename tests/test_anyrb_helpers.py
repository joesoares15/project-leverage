from scripts.build_anyrb_data import fantasy_points, season_windows, summarize


def test_fantasy_points_modes():
    row = {"fantasy_points": 10, "fantasy_points_ppr": 14, "receptions": 4}
    assert fantasy_points(row, "standard") == 10
    assert fantasy_points(row, "half") == 12
    assert fantasy_points(row, "ppr") == 14


def test_season_windows():
    assert season_windows([2019, 2020, 2021, 2022, 2023, 2024]) == {
        "2019-2024": [2019, 2020, 2021, 2022, 2023, 2024],
        "2021-2024": [2021, 2022, 2023, 2024],
        "2023-2024": [2023, 2024],
    }


def test_summarize_counts_player_seasons_and_signals():
    rows = [
        {"season": 2024, "id": "a", "hit": True, "workloadSignal": True, "injurySignal": False, "receivingSignal": False, "combinedSignal": True, "opportunityDelta": 55},
        {"season": 2024, "id": "a", "hit": False, "workloadSignal": False, "injurySignal": False, "receivingSignal": False, "combinedSignal": False, "opportunityDelta": 10},
        {"season": 2024, "id": "b", "hit": True, "workloadSignal": False, "injurySignal": True, "receivingSignal": False, "combinedSignal": True, "opportunityDelta": 60},
    ]
    result = summarize(rows, "RB")
    assert result["observations"] == 3
    assert result["players"] == 2
    assert result["hits"] == 2
    assert result["playerHitRate"] == 1
    assert result["avgUsableWeeks"] == 1
    assert result["combined"]["n"] == 2
    assert result["combined"]["hit"] == 1
