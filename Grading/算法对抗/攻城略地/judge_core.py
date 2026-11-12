"""Official entry point. Import the exact publicly shipped referee and engine."""
from pathlib import Path
import sys
sys.dont_write_bytecode = True

PUBLIC_KIT = Path(__file__).resolve().parents[3] / "算法对抗" / "攻城略地"
sys.path.insert(0,str(PUBLIC_KIT))
from referee_core import Match, run_matches, run_game, build_bridge, load_calibration

__all__ = ["Match","run_matches","run_game","build_bridge","load_calibration","PUBLIC_KIT"]
