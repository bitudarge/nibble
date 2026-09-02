import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

// Keeps this test hermetic (no real network call to Supabase) and fast —
// it only needs to prove a signed-out visitor lands on the login page.
vi.mock('./lib/supabase/client', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}))

describe('App', () => {
  it('sends a signed-out visitor to the login page', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: /nibble/i })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })
})
