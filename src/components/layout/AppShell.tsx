import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Logo } from '../brand/Logo'
import { useAuth } from '../../lib/auth/useAuth'
import { getStreak } from '../../lib/goals/data'
import { resolveDisplayIdentity } from '../../lib/profile/identity'
import type { ReadingStreak } from '../../types/database'
import {
  CirclesIcon,
  DiscoverIcon,
  HamburgerIcon,
  HomeIcon,
  RecsIcon,
  ShelvesIcon,
  StreakIcon,
} from './navIcons'

/**
 * The five places in the app, in the order they appear in both the phone
 * bottom tab bar and the desktop hamburger menu, matching the round 4
 * mockup's own tab order exactly (Home, Shelves, Discover, Picks,
 * Circles). Profile ("You") isn't one of these — like the mockup, it's
 * reached via the header's "You" pill instead, not a sixth tab. `end:
 * true` on Home stops it matching every other route (NavLink otherwise
 * treats "/" as a prefix of everything).
 */
const NAV_ITEMS = [
  { key: 'home', label: 'Home', to: '/', icon: HomeIcon, end: true },
  { key: 'shelves', label: 'Shelves', to: '/shelves', icon: ShelvesIcon, end: false },
  { key: 'discover', label: 'Discover', to: '/search', icon: DiscoverIcon, end: false },
  { key: 'recs', label: 'Picks', to: '/recommendations', icon: RecsIcon, end: false },
  { key: 'circles', label: 'Circles', to: '/circles', icon: CirclesIcon, end: false },
] as const

/**
 * Persistent nav + user menu wrapping every signed-in page (via RequireAuth
 * -> AppShell -> <Outlet />, see App.tsx). A persistent header (logo/back,
 * streak pill, "You" pill) on every screen, matching the round 4 mockup's
 * own chrome exactly. Phone: a bottom tab bar. Desktop (md and up): a
 * hamburger menu in the header rather than a permanent sidebar, opens a
 * dropdown panel with the same five destinations plus the user's own
 * name/sign-out.
 */
export function AppShell() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const [streak, setStreak] = useState<ReadingStreak | null>(null)

  const { displayName, avatarUrl } = resolveDisplayIdentity(user, profile)

  // The header streak pill is read-only/informational everywhere (tapping
  // it in the mockup just pops a toast repeating the same number back),
  // so a light one-time fetch on mount is enough — it doesn't need to
  // stay in sync with every page's own streak-changing actions second to
  // second, just be roughly right whenever a page is opened or changed.
  useEffect(() => {
    let cancelled = false
    if (!user) return
    getStreak(user.id).then((s) => {
      if (!cancelled) setStreak(s)
    })
    return () => {
      cancelled = true
    }
  }, [user])

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
          <Logo variant="full" className="h-8" />
        </div>

        {/* Streak pill + "You" pill, always visible on every screen —
            matches the round 4 mockup's own persistent header exactly.
            Both are informational/navigational only, tapping "You" is
            the one real action (straight to your own profile page). */}
        <div className="flex flex-none items-center gap-2">
          <div
            aria-label="Reading streak"
            className="flex h-10 items-center gap-1.5 rounded-full bg-tint px-3.5"
          >
            <StreakIcon className="text-sage" />
            <span className="font-sans text-sm font-extrabold text-on-leaf">
              {streak?.current_streak ?? 0}
            </span>
          </div>
          {/* The picture is enough on its own once there is one — a
              "You" label next to it was redundant (the owner's own
              feedback). Only shown as text when there's no avatar to
              show instead, so the pill never collapses to nothing
              tappable. */}
          {avatarUrl ? (
            <Link
              to="/wrap"
              aria-label="Go to your profile"
              className="flex h-11 w-11 flex-none items-center justify-center rounded-full transition-transform active:scale-95"
            >
              <img src={avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
            </Link>
          ) : (
            <Link
              to="/wrap"
              aria-label="Go to your profile"
              className="flex h-11 items-center gap-2 rounded-full bg-leaf px-4 font-sans text-sm font-extrabold text-on-leaf transition-transform active:scale-95"
            >
              You
            </Link>
          )}
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
              <Link
                to="/wrap"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
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
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{displayName}</span>
              </Link>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="flex-none text-xs font-semibold text-muted transition-colors hover:text-ink active:text-ink"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 px-4 pt-4 pb-32 md:px-8 md:pt-6 md:pb-10">
        <div className="mx-auto w-full max-w-5xl">
          <Outlet />
        </div>
      </main>

      {/* Phone bottom tab bar: a floating rounded pill with margin on every
          side (hidden from md upward, where the hamburger menu is used
          instead), matching the round 4 mockup's own floating bar rather
          than a full-width strip flush against the screen edges. */}
      <nav
        className="fixed inset-x-3 bottom-3 z-20 rounded-[28px] bg-surface px-2 pt-2 shadow-lift md:hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
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
