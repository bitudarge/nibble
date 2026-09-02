import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { AuthProvider } from './lib/auth/AuthProvider'
import { BookPage } from './routes/BookPage'
import { CircleHome } from './routes/CircleHome'
import { Circles } from './routes/Circles'
import { Home } from './routes/Home'
import { Login } from './routes/Login'
import { RequireAuth } from './routes/RequireAuth'
import { Search } from './routes/Search'
import { Shelves } from './routes/Shelves'

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
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/shelves" element={<Shelves />} />
            <Route path="/book/:bookId" element={<BookPage />} />
            <Route path="/circles" element={<Circles />} />
            <Route path="/circles/:circleId" element={<CircleHome />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
