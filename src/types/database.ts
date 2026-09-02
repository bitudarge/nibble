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

export interface ReadingGoal {
  id: string
  user_id: string
  year: number
  target_books: number
  created_at: string
}

export interface ReadingStreak {
  user_id: string
  current_streak: number
  longest_streak: number
  last_active_date: string | null
}
