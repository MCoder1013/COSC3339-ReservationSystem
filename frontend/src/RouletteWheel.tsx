import { Wheel } from "react-custom-roulette";

export type SlotData = {
  option: string;
  style: { backgroundColor: string; textColor: string };
};

type Props = {
  mustSpin: boolean;
  prizeNumber: number;
  data: SlotData[];
  onStopSpinning: (slot: SlotData) => void;
};

export default function RouletteWheel({ mustSpin, prizeNumber, data, onStopSpinning }: Props) {
  return (
    <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
      <div style={{ transform: "scale(1.35)" }}>
        <Wheel
          mustStartSpinning={mustSpin}
          prizeNumber={prizeNumber}
          data={data}
          onStopSpinning={() => onStopSpinning(data[prizeNumber])}
          fontSize={16}
          textDistance={80}
        />
      </div>
    </div>
  );
}