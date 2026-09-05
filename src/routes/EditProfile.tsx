import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { MASCOT_POSES, type MascotPose } from '../components/brand/mascotPoses'
import { useAuth } from '../lib/auth/useAuth'
import { updateProfile } from '../lib/profile/data'
import { resolveDisplayIdentity } from '../lib/profile/identity'

const MASCOT_PICKER_ORDER: { pose: MascotPose; label: string }[] = [
  { pose: 'eating', label: 'Nibbling' },
  { pose: 'hearts', label: 'In love with it' },
  { pose: 'idea', label: 'Got an idea' },
  { pose: 'thinking', label: 'Thinking it over' },
  { pose: 'curious', label: 'Curious' },
  { pose: 'resting', label: 'Taking it easy' },
]

/**
 * Lets a user edit the name/avatar the rest of the app shows for them
 * (comments, circle reviews, the nav header), see resolveDisplayIdentity
 * for how this overrides the Google account's own name/photo once set.
 * No Supabase Storage bucket exists yet, so a real photo is still a plain
 * image URL field, but picking one of the mascot's own poses needs no
 * upload at all, it's just a bundled asset's resolved URL — same
 * `avatar_url` column either way, the picker just fills the same field.
 */
export function EditProfile() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const current = resolveDisplayIdentity(user, profile)

  const [displayName, setDisplayName] = useState(current.displayName)
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    const trimmedName = displayName.trim()
    if (!trimmedName) {
      setError('Give yourself a name before saving.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await updateProfile(user.id, {
        display_name: trimmedName,
        avatar_url: avatarUrl.trim() || null,
      })
      await refreshProfile()
      navigate('/wrap')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile. Try again.')
      setSaving(false)
    }
  }

  const previewUrl = avatarUrl.trim() || undefined

  return (
    <div className="mx-auto max-w-lg" style={{ animation: 'nib-in 0.26s ease both' }}>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Edit profile</h1>
      <p className="mb-5 font-sans text-sm text-muted">
        This is the name and photo people see on your comments and reviews.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        <div className="flex items-center gap-3.5">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <div
              aria-hidden
              className="flex h-14 w-14 items-center justify-center rounded-full bg-leaf font-sans text-2xl font-extrabold text-on-leaf"
            >
              {(displayName || 'R').charAt(0).toUpperCase()}
            </div>
          )}
          <p className="font-sans text-xs text-muted">This is how your photo will look.</p>
        </div>

        <label className="flex flex-col gap-1.5 font-sans text-sm text-ink">
          Name
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={saving}
            className="rounded-full border border-line bg-page px-3.5 py-2 font-sans text-sm text-ink outline-none"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="font-sans text-sm text-ink">Or pick a mascot</span>
          <div className="flex flex-wrap gap-2.5">
            {MASCOT_PICKER_ORDER.map(({ pose, label }) => {
              const src = MASCOT_POSES[pose]
              const selected = avatarUrl === src
              return (
                <button
                  key={pose}
                  type="button"
                  onClick={() => setAvatarUrl(src)}
                  disabled={saving}
                  aria-label={label}
                  aria-pressed={selected}
                  title={label}
                  className={`h-16 w-16 flex-none rounded-2xl p-1 transition-transform active:scale-95 ${
                    selected ? 'bg-leaf ring-2 ring-sage' : 'bg-tint'
                  }`}
                >
                  <img src={src} alt="" className="h-full w-full object-contain" />
                </button>
              )
            })}
          </div>
        </div>

        <label className="flex flex-col gap-1.5 font-sans text-sm text-ink">
          Photo URL (optional)
          <input
            type="text"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…"
            disabled={saving}
            className="rounded-full border border-line bg-page px-3.5 py-2 font-sans text-sm text-ink outline-none"
          />
        </label>

        {error && <p className="font-sans text-sm text-honey-text">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="btn-cta self-start rounded-full bg-sage px-6 py-2.5 font-sans text-sm font-bold text-surface disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  )
}
