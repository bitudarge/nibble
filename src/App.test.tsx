import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the Nibble heading and a connection status', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /nibble/i })).toBeInTheDocument()
    expect(screen.getByTestId('connection-status')).toBeInTheDocument()
  })
})
