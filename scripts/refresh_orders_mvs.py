#!/usr/bin/env python3
"""Refresh ops order materialized views (manual / CI)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sync_orders import refresh_summaries

if __name__ == "__main__":
    raise SystemExit(0 if refresh_summaries() else 1)
