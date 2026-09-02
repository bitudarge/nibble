import { supabase } from '../supabase/client'
import type {
  Book,
  Circle,
  CircleMember,
  CircleMessage,
  CircleRead,
  Profile,
  Review,
  ShelfItem,
} from '../../types/database'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured — check your .env file.')
  return supabase
}

export async function getMyCircles(userId: string): Promise<Circle[]> {
  const db = requireSupabase()
  const { data, error } = await db.from('circle_members').select('circles(*)').eq('user_id', userId)
  if (error) throw error
  return (data ?? []).flatMap((row) => (row.circles ? [row.circles as unknown as Circle] : []))
}

/** The owner's circle_members row is created by a DB trigger — see the schema. */
export async function createCircle(userId: string, name: string): Promise<Circle> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('circles')
    .insert({ name, owner_id: userId })
    .select('*')
    .single()
  if (error) throw error
  return data as Circle
}

/** Server-side validated join — see join_circle_by_code in the migrations. */
export async function joinCircleByCode(joinCode: string): Promise<Circle> {
  const db = requireSupabase()
  const { data, error } = await db.rpc('join_circle_by_code', { p_join_code: joinCode })
  if (error) throw error
  return data as Circle
}

export async function getCircleById(circleId: string): Promise<Circle | null> {
  const db = requireSupabase()
  const { data, error } = await db.from('circles').select('*').eq('id', circleId).maybeSingle()
  if (error) throw error
  return data as Circle | null
}

export interface CircleMemberWithProfile extends CircleMember {
  profiles: Profile
}

export async function getCircleMembers(circleId: string): Promise<CircleMemberWithProfile[]> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('circle_members')
    .select('*, profiles(*)')
    .eq('circle_id', circleId)
    .order('joined_at')
  if (error) throw error
  return (data ?? []) as unknown as CircleMemberWithProfile[]
}

export interface CircleMessageWithAuthor extends CircleMessage {
  profiles: Profile
  books: Book | null
}

export async function getCircleMessages(circleId: string): Promise<CircleMessageWithAuthor[]> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('circle_messages')
    .select('*, profiles(*), books(*)')
    .eq('circle_id', circleId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as unknown as CircleMessageWithAuthor[]
}

export async function postCircleMessage(
  circleId: string,
  userId: string,
  body: string,
  bookId: string | null,
): Promise<CircleMessage> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('circle_messages')
    .insert({ circle_id: circleId, user_id: userId, body, book_id: bookId })
    .select('*')
    .single()
  if (error) throw error
  return data as CircleMessage
}

export interface CircleReviewWithDetails extends Review {
  profiles: Profile
  books: Book
}

export async function getCircleReviews(circleId: string): Promise<CircleReviewWithDetails[]> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('reviews')
    .select('*, profiles(*), books(*)')
    .eq('circle_id', circleId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as CircleReviewWithDetails[]
}

export interface CircleReadWithBook extends CircleRead {
  books: Book
}

export async function getCircleReads(circleId: string): Promise<CircleReadWithBook[]> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('circle_reads')
    .select('*, books(*)')
    .eq('circle_id', circleId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as CircleReadWithBook[]
}

export async function startCircleRead(
  circleId: string,
  bookId: string,
  targetFinishDate: string | null,
): Promise<CircleRead> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('circle_reads')
    .insert({
      circle_id: circleId,
      book_id: bookId,
      target_finish_date: targetFinishDate,
      status: 'active',
      started_at: new Date().toISOString(),
    })
    .select('*')
    .single()
  if (error) throw error
  return data as CircleRead
}

export interface MemberProgress extends ShelfItem {
  profiles: Profile
}

/** Powered by the circle_read-scoped RLS policy — see the migration. */
export async function getMemberProgressForBook(bookId: string): Promise<MemberProgress[]> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('shelf_items')
    .select('*, profiles(*)')
    .eq('book_id', bookId)
  if (error) throw error
  return (data ?? []) as unknown as MemberProgress[]
}

export interface RecentCircleActivity extends CircleMessage {
  profiles: Profile
  circle_name: string
}

/** Light cross-circle feed for the Dashboard — most recent messages across all the user's circles. */
export async function getRecentCircleActivity(userId: string): Promise<RecentCircleActivity[]> {
  const circles = await getMyCircles(userId)
  if (circles.length === 0) return []

  const perCircle = await Promise.all(
    circles.map(async (circle) => {
      const messages = await getCircleMessages(circle.id)
      return messages.slice(0, 5).map((m) => ({ ...m, circle_name: circle.name }))
    }),
  )

  return perCircle
    .flat()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)
}

export interface ShowcaseItem extends ShelfItem {
  profiles: Profile
  books: Book
}

/** Finished books from this circle's members — powered by the "showcase" RLS policy. */
export async function getCircleShowcase(circleId: string): Promise<ShowcaseItem[]> {
  const db = requireSupabase()

  const { data: members, error: membersError } = await db
    .from('circle_members')
    .select('user_id')
    .eq('circle_id', circleId)
  if (membersError) throw membersError

  const memberIds = (members ?? []).map((m) => m.user_id as string)
  if (memberIds.length === 0) return []

  const { data, error } = await db
    .from('shelf_items')
    .select('*, profiles(*), books(*)')
    .eq('status', 'finished')
    .in('user_id', memberIds)
    .order('finished_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []) as unknown as ShowcaseItem[]
}
