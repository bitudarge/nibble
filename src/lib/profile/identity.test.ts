import { describe, expect, it } from 'vitest'
import { resolveDisplayIdentity } from './identity'
import type { Profile } from '../../types/database'

// Only the fields resolveDisplayIdentity actually reads, cast through
// unknown since a real Supabase User has many more fields this doesn't need.
function fakeUser(metadata: Record<string, unknown>, email?: string) {
  return { user_metadata: metadata, email } as unknown as Parameters<
    typeof resolveDisplayIdentity
  >[0]
}

function fakeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'u1',
    display_name: 'Profile Name',
    avatar_url: 'https://example.com/avatar.png',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('resolveDisplayIdentity', () => {
  it('prefers the profile over Google metadata when both are set', () => {
    const result = resolveDisplayIdentity(
      fakeUser({ full_name: 'Google Name', avatar_url: 'https://example.com/google.png' }),
      fakeProfile(),
    )
    expect(result.displayName).toBe('Profile Name')
    expect(result.avatarUrl).toBe('https://example.com/avatar.png')
  })

  it('falls back to Google metadata when there is no profile row', () => {
    const result = resolveDisplayIdentity(
      fakeUser({ full_name: 'Google Name', avatar_url: 'https://example.com/google.png' }),
      null,
    )
    expect(result.displayName).toBe('Google Name')
    expect(result.avatarUrl).toBe('https://example.com/google.png')
  })

  it('falls back to Google metadata for whichever profile field is unset', () => {
    const result = resolveDisplayIdentity(
      fakeUser({ full_name: 'Google Name', avatar_url: 'https://example.com/google.png' }),
      fakeProfile({ display_name: '', avatar_url: null }),
    )
    expect(result.displayName).toBe('Google Name')
    expect(result.avatarUrl).toBe('https://example.com/google.png')
  })

  it('falls back to the email when neither profile nor Google has a name', () => {
    const result = resolveDisplayIdentity(fakeUser({}, 'reader@example.com'), null)
    expect(result.displayName).toBe('reader@example.com')
  })

  it('falls back to "Reader" as a last resort', () => {
    const result = resolveDisplayIdentity(fakeUser({}), null)
    expect(result.displayName).toBe('Reader')
    expect(result.avatarUrl).toBeUndefined()
  })

  it('handles a null user', () => {
    const result = resolveDisplayIdentity(null, null)
    expect(result.displayName).toBe('Reader')
    expect(result.avatarUrl).toBeUndefined()
  })
})
