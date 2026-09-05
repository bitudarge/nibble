import { Logo } from '../brand/Logo'

/**
 * Shown by App.tsx's <Suspense> boundary while a lazily-loaded route's own
 * JS chunk downloads (see App.tsx's own comment for why routes are code
 * split at all). Same wiggling-mark-plus-caption shape Shelves.tsx already
 * used for its own loading state, reused here instead of a third loading
 * treatment, but generic ("Getting things ready") since this fires for
 * any route, not just one page's own data fetch.
 */
export function RouteLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <div style={{ animation: 'nib-wig 2.6s ease-in-out infinite', transformOrigin: '50% 80%' }}>
        <Logo variant="mark" className="h-16" />
      </div>
      <p className="font-sans text-sm text-muted">Getting things ready.</p>
    </div>
  )
}
