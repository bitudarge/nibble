import type { BookTag } from '../../types/database'

const TAG_TYPE_LABELS: Record<string, string> = {
  mood: 'Mood',
  pace: 'Pace',
  spice_level: 'Spice level',
  genre: 'Genre',
}

/**
 * The mood/pace/spice_level/genre chip picker, grouped by type. Shared
 * between QuickNoteNudge (where tagging now happens, once, at rating time)
 * and ReviewEditor's private-note path (still editable there after the
 * fact) — pulled out here so the two don't duplicate the same grouping and
 * chip-rendering logic.
 */
export function TagPicker({
  allTags,
  selectedTagIds,
  onToggle,
}: {
  allTags: BookTag[]
  selectedTagIds: string[]
  onToggle: (tagId: string) => void
}) {
  const tagsByType: Record<string, BookTag[]> = {}
  for (const tag of allTags) {
    ;(tagsByType[tag.type] ??= []).push(tag)
  }

  return (
    <div className="flex flex-col gap-2">
      {Object.entries(tagsByType).map(([type, tags]) => (
        <div key={type}>
          <span className="font-sans text-xs font-bold tracking-wide text-muted uppercase">
            {TAG_TYPE_LABELS[type] ?? type}
          </span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => onToggle(tag.id)}
                aria-pressed={selectedTagIds.includes(tag.id)}
                className={`rounded-full px-2.5 py-1 font-sans text-xs font-bold transition-transform active:scale-95 ${
                  selectedTagIds.includes(tag.id) ? 'bg-leaf text-on-leaf' : 'bg-tint text-muted'
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
