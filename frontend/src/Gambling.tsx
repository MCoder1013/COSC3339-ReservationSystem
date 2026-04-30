import { useMemo, useState } from "react";
import "./App.css";
import NavBar from "./NavBar";
import RouletteWheel from "./RouletteWheel";
import type { SlotData } from "./RouletteWheel";

type BetType = "color" | "number";
type BetColor = "blue" | "purple" | "white";

type Bet = {
  wager: number;
  betType: BetType;
  color: BetColor | null;
  number: number | null;
};

function buildWheelData(): SlotData[] {
  const result: SlotData[] = [];
  const whitePositions = new Set<number>();
  while (whitePositions.size < 2) {
    whitePositions.add(Math.floor(Math.random() * 38));
  }

  let blueCount = 0;
  let purpleCount = 0;

  for (let i = 0; i < 38; i++) {
    if (whitePositions.has(i)) {
      result.push({ option: i.toString(), style: { backgroundColor: "white", textColor: "black" } });
    } else if (blueCount < 18 && (i % 2 === 0 || purpleCount >= 18)) {
      result.push({ option: i.toString(), style: { backgroundColor: "blue", textColor: "white" } });
      blueCount++;
    } else {
      result.push({ option: i.toString(), style: { backgroundColor: "purple", textColor: "white" } });
      purpleCount++;
    }
  }
  return result;
}

function getMultiplier(bet: Bet): number {
  if (bet.betType === "number") return 36;
  if (bet.color === "white") return 18;
  return 2;
}

function checkWin(slot: SlotData, bet: Bet): boolean {
  if (bet.betType === "number") return slot.option === String(bet.number);
  return (slot.style.backgroundColor as BetColor) === bet.color;
}

const QUICK_CHIPS = [5, 10, 25, 50, 100];
const STARTING_BALANCE = 500;

export default function Gambling() {
  const shipName = "Starlight Pearl Cruises";
  const wheelData = useMemo(() => buildWheelData(), []);

  // Wheel state
  const [mustSpin, setMustSpin] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const [pendingBet, setPendingBet] = useState<Bet | null>(null);

  // Balance & result
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [lastResult, setLastResult] = useState<{ won: boolean; amount: number } | null>(null);

  // Betting panel local state
  const [wager, setWager] = useState(10);
  const [betType, setBetType] = useState<BetType>("color");
  const [selectedColor, setSelectedColor] = useState<BetColor | null>(null);
  const [selectedNumber, setSelectedNumber] = useState(7);

  const currentBet: Bet = { wager, betType, color: selectedColor, number: selectedNumber };
  const potentialWin = wager * getMultiplier(currentBet);
  const canBet = !mustSpin && wager >= 1 && wager <= balance && (betType === "number" || selectedColor !== null);

  const handlePlaceBet = () => {
    if (!canBet) return;
    setBalance((b) => b - wager);
    setLastResult(null);
    setPendingBet({ ...currentBet });
    const newPrize = Math.floor(Math.random() * wheelData.length);
    setPrizeNumber(newPrize);
    setMustSpin(true);
  };

  const handleStopSpinning = (slot: SlotData) => {
    setMustSpin(false);
    if (!pendingBet) return;
    const won = checkWin(slot, pendingBet);
    const payout = won ? pendingBet.wager * getMultiplier(pendingBet) : 0;
    if (won) setBalance((b) => b + payout);
    setLastResult({ won, amount: won ? payout : pendingBet.wager });
    setPendingBet(null);
  };

  return (
    <div className="page">
      <NavBar shipName={shipName} />

      <main className="gamble-layout">
        <div className="left-panel">
          <RouletteWheel
            mustSpin={mustSpin}
            prizeNumber={prizeNumber}
            data={wheelData}
            onStopSpinning={handleStopSpinning}
          />
        </div>

        <div className="right-panel">
          <div className="betting-panel">

            {/* Balance */}
            <div className="bp-section">
              <span className="bp-label">your balance</span>
              <div className="bp-pearl-display">
                <span className="bp-pearl-count">{balance}</span>
                <span className="bp-pearl-unit">pearls</span>
              </div>
            </div>

            <hr className="bp-divider" />

            {/* Wager */}
            <div className="bp-section">
              <span className="bp-label">wager amount</span>
              <div className="bp-wager-row">
                <input
                  type="number"
                  className="bp-number-input"
                  min={1}
                  max={balance}
                  value={wager}
                  onChange={(e) => setWager(Math.max(1, Math.min(balance, Number(e.target.value))))}
                />
                <span className="bp-pearl-unit">pearls</span>
              </div>
              <div className="bp-chip-row">
                {QUICK_CHIPS.map((c) => (
                  <button key={c} className="bp-chip" onClick={() => setWager(Math.min(c, balance))}>
                    {c}
                  </button>
                ))}
                <button className="bp-chip" onClick={() => setWager(balance)}>max</button>
              </div>
            </div>

            <hr className="bp-divider" />

            {/* Bet type */}
            <div className="bp-section">
              <span className="bp-label">bet type</span>
              <div className="bp-type-grid">
                <button
                  className={`bp-type-btn${betType === "color" ? " bp-type-btn--active" : ""}`}
                  onClick={() => setBetType("color")}
                >
                  Color
                  <span className="bp-payout-tag">2× payout</span>
                </button>
                <button
                  className={`bp-type-btn${betType === "number" ? " bp-type-btn--active" : ""}`}
                  onClick={() => setBetType("number")}
                >
                  Exact number
                  <span className="bp-payout-tag">36× payout</span>
                </button>
              </div>
            </div>

            {/* Color picker */}
            {betType === "color" && (
              <div className="bp-section">
                <span className="bp-label">pick a color</span>
                <div className="bp-color-row">
                  {(["blue", "purple", "white"] as BetColor[]).map((c) => (
                    <button
                      key={c}
                      className={`bp-color-btn bp-color-btn--${c}${selectedColor === c ? " bp-color-btn--active" : ""}`}
                      onClick={() => setSelectedColor(c)}
                    >
                      {c === "white" ? <>White <span className="bp-payout-tag">18×</span></> : c.charAt(0).toUpperCase() + c.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Number picker */}
            {betType === "number" && (
              <div className="bp-section">
                <span className="bp-label">pick a number (0 – 37)</span>
                <input
                  type="number"
                  className="bp-number-input"
                  min={0}
                  max={37}
                  value={selectedNumber}
                  onChange={(e) => setSelectedNumber(Math.max(0, Math.min(37, Number(e.target.value))))}
                />
              </div>
            )}

            <hr className="bp-divider" />

            {/* Result */}
            {lastResult && (
              <div className={`bp-result${lastResult.won ? " bp-result--win" : " bp-result--lose"}`}>
                {lastResult.won
                  ? `+${lastResult.amount} pearls — you won!`
                  : `-${lastResult.amount} pearls — better luck next time.`}
              </div>
            )}

            <button className="bp-spin-btn" disabled={!canBet} onClick={handlePlaceBet}>
              {mustSpin ? "Spinning…" : "Place bet & spin"}
            </button>

            <div className="bp-potential">
              Potential win: <strong>{potentialWin} pearls</strong>
            </div>

          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="container">© 2026 {shipName}</div>
      </footer>
    </div>
  );
}