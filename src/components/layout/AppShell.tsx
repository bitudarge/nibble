import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Logo } from '../brand/Logo'
import { useAuth } from '../../lib/auth/useAuth'
import { useTheme } from '../../lib/theme/useTheme'
import {
  CirclesIcon,
  DiscoverIcon,
  HamburgerIcon,
  HomeIcon,
  MoonIcon,
  RecsIcon,
  ShelvesIcon,
  SunIcon,
  YouIcon,
} from './navIcons'

/**
 * The six places in the app, in the order they appear in both the phone
 * bottom tab bar and the desktop hamburger menu. `end: true` on Home stops
 * it matching every other route (NavLink otherwise treats "/" as a prefix
 * of everything).
 */
const NAV_ITEMS = [
  { key: 'home', label: 'Home', to: '/', icon: HomeIcon, end: true },
  { key: 'discover', label: 'Discover', to: '/search', icon: DiscoverIcon, end: false },
  { key: 'shelves', label: 'Shelves', to: '/shelves', icon: ShelvesIcon, end: false },
  { key: 'circles', label: 'Circles', to: '/circles', icon: CirclesIcon, end: false },
  { key: 'recs', label: 'Recs', to: '/recommendations', icon: RecsIcon, end: false },
  { key: 'you', label: 'You', to: '/wrap', icon: YouIcon, end: false },
] as const

/**
 * Persistent nav + user menu wrapping every signed-in page (via RequireAuth
 * -> AppShell -> <Outlet />, see App.tsx). Phone: a bottom tab bar. Desktop
 * (md and up): a hamburger menu in the header rather than a permanent
 * sidebar, opens a dropdown panel with the same six destinations plus the
 * user's own name/sign-out.
 */
export function AppShell() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  const rawName = user?.user_metadata?.full_name
  const displayName = typeof rawName === 'string' && rawName ? rawName : (user?.email ?? 'Reader')
  const rawAvatar = user?.user_metadata?.avatar_url
  const avatarUrl = typeof rawAvatar === 'string' ? rawAvatar : undefined

  // Close the menu on Escape and on an outside click, and return focus to
  // the hamburger button when it closes from Escape so keyboard users
  // don't lose their place. Navigating away closes it too, but via each
  // NavLink's own onClick below (a real event handler), not an effect —
  // setting state straight from a mount/update effect body trips the
  // set-state-in-effect lint rule for good reason (it's usually a sign of
  // mirroring props into state), and there's a real event to hang this on
  // here anyway.
  useEffect(() => {
    if (!menuOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        toggleRef.current?.focus()
      }
    }
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      <header className="relative flex flex-none items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 md:px-8 md:py-4">
        <div className="flex items-center gap-3">
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="hidden h-11 w-11 flex-none items-center justify-center rounded-full bg-tint text-ink transition-transform active:scale-90 md:flex"
          >
            <HamburgerIcon />
          </button>
          <Logo variant="mark" className="h-9 md:hidden" />
          <Logo variant="full" className="hidden h-8 md:block" />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === 'light' ? 'Switch to nighttime reading' : 'Switch to daytime reading'
            }
            className="flex h-11 w-11 items-center justify-center rounded-full bg-tint text-muted transition-transform active:scale-90"
          >
            {theme === 'light' ? <SunIcon /> : <MoonIcon className="text-honey" />}
          </button>
          <div className="hidden items-center gap-2 md:flex">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full" />
            ) : (
              <div
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf text-sm font-bold text-on-leaf"
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {menuOpen && (
          <div
            ref={menuRef}
            role="menu"
            aria-label="Main"
            className="absolute top-full left-4 z-30 mt-2 hidden w-64 flex-col gap-1 rounded-2xl border border-line bg-surface p-3 shadow-lift md:flex"
            style={{ animation: 'nib-in 0.16s ease both' }}
          >
            {NAV_ITEMS.map(({ key, label, to, icon: Icon, end }) => (
              <NavLink
                key={key}
                to={to}
                end={end}
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-3 py-2.5 font-sans text-sm font-bold transition-colors ${
                    isActive ? 'bg-leaf text-on-leaf' : 'text-muted hover:bg-tint hover:text-ink'
                  }`
                }
              >
                <Icon />
                {label}
              </NavLink>
            ))}

            <div className="mt-1 flex items-center gap-3 rounded-2xl border border-line bg-page px-3 py-2.5">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-9 w-9 flex-none rounded-full" />
              ) : (
                <div
                  aria-hidden
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-leaf text-sm font-bold text-on-leaf"
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{displayName}</div>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="text-xs font-semibold text-muted transition-colors hover:text-ink active:text-ink"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-6 md:pb-10">
        <div className="mx-auto w-full max-w-5xl">
          <Outlet />
        </div>
      </main>

      {/* Phone bottom tab bar (hidden from md upward, where the hamburger menu is used instead) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-2 pt-1.5 md:hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 6px)' }}
        aria-label="Main"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-between gap-1">
          {NAV_ITEMS.map(({ key, label, to, icon: Icon, end }) => (
            <NavLink
              key={key}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-[19px] py-1.5 text-[11px] font-bold transition-colors ${
                  isActive ? 'bg-leaf text-on-leaf' : 'text-muted'
                }`
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
