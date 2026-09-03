/** One tappable chip for a quiz question, single- or multi-select. */
export function ChipToggle({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full px-3.5 py-2 font-sans text-[13px] font-bold transition-transform active:scale-95 ${
        selected ? 'bg-leaf text-on-leaf' : 'bg-tint text-ink'
      }`}
    >
      {label}
    </button>
  )
}
