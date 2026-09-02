/**
 * A native range input rather than custom clickable star icons — half-star
 * precision "for free" and keyboard-navigable without any hit-testing code.
 */
export function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number | null
  onChange: (value: number) => void
  disabled?: boolean
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="range"
        min={0.5}
        max={5}
        step={0.5}
        value={value ?? 0.5}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        aria-label="Your rating"
      />
      <span className="w-20 text-sm text-stone-700">
        {value ? `★ ${value.toFixed(1)}` : 'Not rated'}
      </span>
    </label>
  )
}
