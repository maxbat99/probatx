"""
Motore probabilistico nascosto per mercato 1X2 / Over2.5 / BTTS.
- Non esposto via API: importare e usare solo dal backend.
- Feature pensate per copertura mondiale e facili da popolare.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Tuple
import math

# -----------------------------
# Feature di input (mondiali)
# -----------------------------
@dataclass
class MatchFeatures:
    # Forza/Elo normalizzati (0..1)
    home_strength: float = 0.5
    away_strength: float = 0.5

    # Forma recente (ultime 5, 0..1)
    home_form: float = 0.5
    away_form: float = 0.5

    # Home advantage (0..1), default ~0.1 = 10% boost
    home_adv: float = 0.10

    # Congestione calendario: minuti giocati ultimi 10 gg / 900 (0..1)
    home_fatigue: float = 0.3
    away_fatigue: float = 0.3

    # Viaggio (km normalizzati su 6000km -> 1.0)
    home_travel: float = 0.0
    away_travel: float = 0.2

    # Importanza match (0..1) – finale/derby/alti incentivi
    importance: float = 0.3

    # Meteo sintetico (0..1)
    #   rain_risk: 0..1 (prob pioggia/quantità normalizzata)
    #   wind_risk: 0..1 (raffiche impattanti ~ >8-10 m/s)
    #   heat_risk: 0..1 (WBGT/temperatura percepita alta)
    rain_risk: float = 0.1
    wind_risk: float = 0.1
    heat_risk: float = 0.1

    # Qualità difensive/offensive (0..1) – opzionali, fallback 0.5
    home_attack: float = 0.5
    home_defense: float = 0.5
    away_attack: float = 0.5
    away_defense: float = 0.5

# -----------------------------
# Utils
# -----------------------------
def _clip01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))

def _sigmoid(z: float) -> float:
    return 1.0 / (1.0 + math.exp(-z))

def _softmax3(a: float, b: float, c: float) -> Tuple[float, float, float]:
    m = max(a, b, c)
    ea, eb, ec = math.exp(a - m), math.exp(b - m), math.exp(c - m)
    s = ea + eb + ec
    return ea/s, eb/s, ec/s

# -----------------------------
# Modello – pesi iniziali
# -----------------------------
class ProbaXModel:
    """
    Tre teste:
      - oneXtwo(): restituisce p(1), p(X), p(2)
      - over25(): restituisce p(Over2.5)
      - btts():   restituisce p(BTTS)
    Pesi iniziali semplici ma sensati; facili da ritoccare.
    """

    def __init__(self) -> None:
        # 1X2 – logit grezzi prima di softmax
        self.w_1 = {
            "bias":  0.00,
            "home_strength":  2.0,
            "away_strength": -2.0,
            "home_form":      0.6,
            "away_form":     -0.6,
            "home_adv":       1.2,
            "home_fatigue":  -0.4,
            "away_fatigue":   0.1,
            "home_travel":   -0.3,
            "away_travel":    0.1,
            "importance":     0.2,
            "rain_risk":     -0.05,
            "wind_risk":     -0.10,
            "heat_risk":     -0.10,
            "home_attack":    0.3,
            "away_defense":  -0.3,
        }
        self.w_X = {
            "bias":  0.10,
            "home_strength":  0.0,
            "away_strength":  0.0,
            "home_form":     -0.05,
            "away_form":     -0.05,
            "home_adv":      -0.1,
            "home_fatigue":   0.1,
            "away_fatigue":   0.1,
            "home_travel":    0.1,
            "away_travel":    0.1,
            "importance":     0.0,
            "rain_risk":      0.10,
            "wind_risk":      0.15,
            "heat_risk":      0.00,
        }
        self.w_2 = {
            "bias":   0.00,
            "home_strength": -2.0,
            "away_strength":  2.0,
            "home_form":     -0.6,
            "away_form":      0.6,
            "home_adv":      -1.2,
            "home_fatigue":   0.1,
            "away_fatigue":  -0.4,
            "home_travel":    0.1,
            "away_travel":   -0.3,
            "importance":     0.2,
            "rain_risk":     -0.05,
            "wind_risk":     -0.10,
            "heat_risk":     -0.10,
            "away_attack":    0.3,
            "home_defense":  -0.3,
        }

        # Over 2.5 – logit
        self.w_over = {
            "bias":        -0.10,
            "home_attack":  0.9,
            "away_attack":  0.9,
            "home_defense": -0.6,
            "away_defense": -0.6,
            "home_form":    0.2,
            "away_form":    0.2,
            "importance":   0.1,   # partite “aperte”
            "rain_risk":   -0.25,  # pioggia riduce rateo gol
            "wind_risk":   -0.15,  # vento riduce precisione
            "heat_risk":   -0.10,  # caldo riduce ritmo
        }

        # BTTS – logit
        self.w_btts = {
            "bias":        -0.05,
            "home_attack":  0.8,
            "away_attack":  0.8,
            "home_defense": -0.7,
            "away_defense": -0.7,
            "home_form":    0.15,
            "away_form":    0.15,
            "importance":   0.05,
            "rain_risk":   -0.15,
            "wind_risk":   -0.10,
            "heat_risk":   -0.05,
        }

    # -----------------------------
    # Calcoli
    # -----------------------------
    def oneXtwo(self, f: MatchFeatures) -> Dict[str, float]:
        d = f.__dict__
        z1 = sum(self.w_1.get(k, 0) * d.get(k, 0) for k in self.w_1)
        zX = sum(self.w_X.get(k, 0) * d.get(k, 0) for k in self.w_X)
        z2 = sum(self.w_2.get(k, 0) * d.get(k, 0) for k in self.w_2)
        p1, pX, p2 = _softmax3(z1, zX, z2)
        return {"1": p1, "X": pX, "2": p2}

    def over25(self, f: MatchFeatures) -> float:
        d = f.__dict__
        z = sum(self.w_over.get(k, 0) * d.get(k, 0) for k in self.w_over)
        return _sigmoid(z)

    def btts(self, f: MatchFeatures) -> float:
        d = f.__dict__
        z = sum(self.w_btts.get(k, 0) * d.get(k, 0) for k in self.w_btts)
        return _sigmoid(z)

    def full_report(self, f: MatchFeatures) -> Dict[str, object]:
        one_x_two = self.oneXtwo(f)
        over = self.over25(f)
        btts = self.btts(f)
        # edge semplici rispetto a linee “neutre”
        edge = {
            "1": one_x_two["1"] - 1/3,
            "X": one_x_two["X"] - 1/3,
            "2": one_x_two["2"] - 1/3,
            "Over2.5": over - 0.50,
            "BTTS": btts - 0.50,
        }
        return {
            "input_features": f.__dict__,
            "markets": {
                "1X2": one_x_two,
                "Over2_5": over,
                "BTTS": btts,
            },
            "edge_vs_neutral": edge,
        }

# Singleton riutilizzabile
MODEL = ProbaXModel()
