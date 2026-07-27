from __future__ import annotations

import json
import sys
from pathlib import Path


def validate(path: Path) -> None:
    payload = json.loads(path.read_text(encoding="utf-8"))
    studies = payload.get("studies") or {}
    if not studies:
        raise SystemExit("Generated dataset contains no studies")
    default = payload.get("metadata", {}).get("default_study")
    if default not in studies:
        raise SystemExit(f"Default study is missing: {default}")
    for key, result in studies.items():
        for pos in ("RB", "WR"):
            block = result.get(pos) or {}
            observations = block.get("observations", 0)
            hit_rate = block.get("hitRate", -1)
            if observations <= 0:
                raise SystemExit(f"{key}: {pos} has no observations")
            if not 0 <= hit_rate <= 1:
                raise SystemExit(f"{key}: {pos} hitRate is invalid: {hit_rate}")
    print(f"Validated {len(studies)} study configurations in {path}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: validate_anyrb_output.py PATH")
    validate(Path(sys.argv[1]))
