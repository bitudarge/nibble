import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../lib/auth/useAuth'

/**
 * Persistent nav + user menu wrapping every signed-in page (via RequireAuth
 * -> AppShell -> <Outlet />, see App.tsx). Only "Home" exists as a real page
 * so far — Search, Shelves, Circles, Recommendations, and Wrap get nav
 * entries here as their pages land in Phases 4–7.
 */
export function AppShell() {
  const { user, signOut } = useAuth()

  const rawName = user?.user_metadata?.full_name
  const displayName = typeof rawName === 'string' && rawName ? rawName : (user?.email ?? 'Reader')
  const rawAvatar = user?.user_metadata?.avatar_url
  const avatarUrl = typeof rawAvatar === 'string' ? rawAvatar : undefined

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="flex items-center justify-between gap-4 border-b border-stone-200 bg-white px-4 py-3">
        <nav className="flex items-center gap-4">
          <NavLink to="/" className="text-lg font-semibold text-stone-900">
            🐛 Nibble
          </NavLink>
        </nav>

        <input
          type="search"
          placeholder="Search books (coming soon)"
          disabled
          aria-label="Search books"
          className="hidden w-64 rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-500 disabled:bg-stone-100 sm:block"
        />

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
