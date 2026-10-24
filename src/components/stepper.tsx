"use client";

type Props = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
};

/** A − value + control with large tap targets. */
export function Stepper({ label, value, min = 0, max = 20, onChange }: Props) {
  const button =
    "flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-xl text-ink active:bg-line disabled:opacity-30";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" className={button} aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          −
        </button>
        <span className="w-6 text-center text-lg font-semibold tabular-nums" aria-live="polite">
          {value}
        </span>
        <button type="button" className={button} aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  );
}
