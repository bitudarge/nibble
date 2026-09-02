import { useState, type FormEvent } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth/useAuth'

const NAV_LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  `text-sm ${isActive ? 'font-semibold text-stone-900' : 'text-stone-600 hover:text-stone-900'}`

/**
 * Persistent nav + user menu wrapping every signed-in page (via RequireAuth
 * -> AppShell -> <Outlet />, see App.tsx). One more nav entry (Wrap) gets
 * added here once its page lands in Phase 7.
 */
export function AppShell() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState('')

  const rawName = user?.user_metadata?.full_name
  const displayName = typeof rawName === 'string' && rawName ? rawName : (user?.email ?? 'Reader')
  const rawAvatar = user?.user_metadata?.avatar_url
  const avatarUrl = typeof rawAvatar === 'string' ? rawAvatar : undefined

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = searchInput.trim()
    if (trimmed) navigate(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 bg-white px-4 py-3">
        <nav className="flex items-center gap-4">
          <NavLink to="/" className="text-lg font-semibold text-stone-900">
            🐛 Nibble
          </NavLink>
          <NavLink to="/" end className={NAV_LINK_CLASS}>
            Home
          </NavLink>
          <NavLink to="/shelves" className={NAV_LINK_CLASS}>
            My Shelves
          </NavLink>
          <NavLink to="/circles" className={NAV_LINK_CLASS}>
            Circles
          </NavLink>
          <NavLink to="/recommendations" className={NAV_LINK_CLASS}>
            Recommendations
          </NavLink>
        </nav>

        <form onSubmit={handleSearchSubmit} className="hidden sm:block">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search books…"
            aria-label="Search books"
            className="w-64 rounded-md border border-stone-300 px-3 py-1.5 text-sm"
          />
        </form>

        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full" />
          ) : (
            <div
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-200 text-sm text-stone-600"
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm text-stone-700">{displayName}</span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm text-stone-500 hover:text-stone-900"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="p-4">
        <Outlet />
      </main>
    </div>
  )
}
