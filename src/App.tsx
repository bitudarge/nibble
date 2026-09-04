import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { AuthProvider } from './lib/auth/AuthProvider'
import { BookPage } from './routes/BookPage'
import { CircleHome } from './routes/CircleHome'
import { Circles } from './routes/Circles'
import { Home } from './routes/Home'
import { Login } from './routes/Login'
import { MyBooks } from './routes/MyBooks'
import { Recommendations } from './routes/Recommendations'
import { RequireAuth } from './routes/RequireAuth'
import { Search } from './routes/Search'
import { Shelves } from './routes/Shelves'
import { TasteQuiz } from './routes/TasteQuiz'
import { Wrap } from './routes/Wrap'

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
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/wrap" element={<Wrap />} />
            <Route path="/my-books" element={<MyBooks />} />
            <Route path="/quiz" element={<TasteQuiz />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
