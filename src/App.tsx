import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { RouteLoading } from './components/layout/RouteLoading'
import { AuthProvider } from './lib/auth/AuthProvider'
import { Login } from './routes/Login'
import { RequireAuth } from './routes/RequireAuth'

// Every signed-in page is loaded on demand instead of bundled into the
// one big chunk everyone downloaded before anything could render — a real
// perf problem, not a hypothetical one: confirmed the built bundle was
// ~596KB minified (~164KB gzipped) with every route's code (Search's
// Open Library logic, the whole recommender engine, taste quiz, circles,
// reviews/ratings, all of it) loaded up front regardless of which single
// page someone actually opened. Splitting each route into its own chunk
// means a visit to, say, Home only downloads Home's own code plus
// whatever's shared, not the entire app. `Login` and the shell
// (`AppShell`/`RequireAuth`) stay eager: they're small, and needed
// immediately for every single visit regardless of destination, so
// lazy-loading them would just add a network round trip with no payoff.
const Home = lazy(() => import('./routes/Home').then((m) => ({ default: m.Home })))
const Search = lazy(() => import('./routes/Search').then((m) => ({ default: m.Search })))
const Shelves = lazy(() => import('./routes/Shelves').then((m) => ({ default: m.Shelves })))
const BookPage = lazy(() => import('./routes/BookPage').then((m) => ({ default: m.BookPage })))
const Circles = lazy(() => import('./routes/Circles').then((m) => ({ default: m.Circles })))
const CircleHome = lazy(() =>
  import('./routes/CircleHome').then((m) => ({ default: m.CircleHome })),
)
const Recommendations = lazy(() =>
  import('./routes/Recommendations').then((m) => ({ default: m.Recommendations })),
)
const Wrap = lazy(() => import('./routes/Wrap').then((m) => ({ default: m.Wrap })))
const MyBooks = lazy(() => import('./routes/MyBooks').then((m) => ({ default: m.MyBooks })))
const EditProfile = lazy(() =>
  import('./routes/EditProfile').then((m) => ({ default: m.EditProfile })),
)
const TasteQuiz = lazy(() => import('./routes/TasteQuiz').then((m) => ({ default: m.TasteQuiz })))

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route
              path="/"
              element={
                <Suspense fallback={<RouteLoading />}>
                  <Home />
                </Suspense>
              }
            />
            <Route
              path="/search"
              element={
                <Suspense fallback={<RouteLoading />}>
                  <Search />
                </Suspense>
              }
            />
            <Route
              path="/shelves"
              element={
                <Suspense fallback={<RouteLoading />}>
                  <Shelves />
                </Suspense>
              }
            />
            <Route
              path="/book/:bookId"
              element={
                <Suspense fallback={<RouteLoading />}>
                  <BookPage />
                </Suspense>
              }
            />
            <Route
              path="/circles"
              element={
                <Suspense fallback={<RouteLoading />}>
                  <Circles />
                </Suspense>
              }
            />
            <Route
              path="/circles/:circleId"
              element={
                <Suspense fallback={<RouteLoading />}>
                  <CircleHome />
                </Suspense>
              }
            />
            <Route
              path="/recommendations"
              element={
                <Suspense fallback={<RouteLoading />}>
                  <Recommendations />
                </Suspense>
              }
            />
            <Route
              path="/wrap"
              element={
                <Suspense fallback={<RouteLoading />}>
                  <Wrap />
                </Suspense>
              }
            />
            <Route
              path="/my-books"
              element={
                <Suspense fallback={<RouteLoading />}>
                  <MyBooks />
                </Suspense>
              }
            />
            <Route
              path="/profile/edit"
              element={
                <Suspense fallback={<RouteLoading />}>
                  <EditProfile />
                </Suspense>
              }
            />
            <Route
              path="/quiz"
              element={
                <Suspense fallback={<RouteLoading />}>
                  <TasteQuiz />
                </Suspense>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
