/**
 * Row shapes matching supabase/migrations/20260901000001_schema.sql.
 * Kept as plain interfaces (not generated) since the schema is still
 * young — if this drifts noticeably from the SQL, regenerate with
 * `supabase gen types typescript` once the Supabase CLI is set up.
 */

export type ShelfStatus = 'want_to_read' | 'reading' | 'finished'
export type ReviewVisibility = 'private' | 'public' | 'circle'
export type TagType = 'mood' | 'pace' | 'spice_level' | 'genre'
export type CircleRole = 'owner' | 'member'
export type CircleReadStatus = 'planned' | 'active' | 'finished'

export interface Book {
  id: string
  open_library_id: string
  title: string
  author: string | null
  cover_url: string | null
  published_year: number | null
  page_count: number | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface ShelfItem {
  id: string
  user_id: string
  book_id: string
  status: ShelfStatus
  current_page: number | null
  percent_complete: number | null
  started_at: string | null
  finished_at: string | null
  updated_at: string
}

export interface Rating {
  id: string
  user_id: string
  book_id: string
  stars: number
  created_at: string
  updated_at: string
}

export interface Review {
  id: string
  user_id: string
  book_id: string
  body: string
  contains_spoilers: boolean
  visibility: ReviewVisibility
  circle_id: string | null
  sentiment_score: number | null
  extracted_themes: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface BookTag {
  id: string
  type: TagType
  name: string
}

export interface ReadingSession {
  id: string
  user_id: string
  book_id: string
  pages_read: number | null
  from_page: number | null
  to_page: number | null
  session_date: string
  created_at: string
}

/**
 * A row is either a legacy yearly goal (`year` set, `period`/`period_key`
 * null) or a monthly/weekly goal (`period`+`period_key` set, `year` null),
 * never both — see the migration that added the period columns for why.
 */
export interface ReadingGoal {
  id: string
  user_id: string
  year: number | null
  period: 'month' | 'week' | null
  period_key: string | null
  target_books: number
  created_at: string
}

export interface ReadingStreak {
  user_id: string
  current_streak: number
  longest_streak: number
  last_active_date: string | null
  rest_days_banked: number
}

export interface Circle {
  id: string
  name: string
  owner_id: string
  join_code: string
  created_at: string
}

export interface CircleMember {
  id: string
  circle_id: string
  user_id: string
  role: CircleRole
  joined_at: string
}

export interface CircleMessage {
  id: string
  circle_id: string
  user_id: string
  body: string
  book_id: string | null
  created_at: string
}

export interface CircleRead {
  id: string
  circle_id: string
  book_id: string
  started_at: string | null
  target_finish_date: string | null
  status: CircleReadStatus
  created_at: string
}

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  created_at: string
}
