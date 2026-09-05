import { supabase } from '../supabase/client'
import type {
  Book,
  Circle,
  CircleMember,
  CircleMessage,
  CircleRead,
  Profile,
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

/** Powered by the existing owner-only `circles_update_owner` RLS policy — no new migration needed. */
export async function renameCircle(circleId: string, name: string): Promise<Circle> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('circles')
    .update({ name })
    .eq('id', circleId)
    .select('*')
    .single()
  if (error) throw error
  return data as Circle
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

/**
 * Removes someone else from a circle — powered by the owner-only
 * `circle_members_delete_owner` RLS policy (migration
 * `20260905000002_circle_group_management.sql`), the same admin-only
 * asymmetry a normal group chat's "remove member" has. A member removing
 * themselves is the separate, already-existing "leave" action
 * (`circle_members_delete_self`), not this function.
 */
export async function removeCircleMember(memberRowId: string): Promise<void> {
  const db = requireSupabase()
  const { error } = await db.from('circle_members').delete().eq('id', memberRowId)
  if (error) throw error
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

/**
 * Drops a book from "reading together" once the circle's done with it —
 * powered by the `circle_reads_delete_member` RLS policy (migration
 * `20260905000002_circle_group_management.sql`), open to any member, the
 * same scope the existing update policy already had.
 */
export async function removeCircleRead(circleReadId: string): Promise<void> {
  const db = requireSupabase()
  const { error } = await db.from('circle_reads').delete().eq('id', circleReadId)
  if (error) throw error
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

/**
 * A single notification-style item for the Home "Circle activity" feed —
 * either a member finishing a book, or a chat message that actually
 * references one (a real "book moment"), never plain freeform chatter.
 * The owner asked for "recent notifications, not everything that is
 * said" — showing raw message text for every line typed in a circle read
 * as a live chat transcript sitting on the dashboard, not a set of
 * distinct, skimmable events. A discriminated union keeps the two event
 * shapes honest rather than forcing a "message-shaped" object to also
 * represent a finish.
 */
export type RecentCircleActivity =
  | {
      kind: 'finished'
      id: string
      createdAt: string
      circleName: string
      displayName: string
      bookId: string
      bookTitle: string
    }
  | {
      kind: 'message'
      id: string
      createdAt: string
      circleName: string
      displayName: string
      body: string
      bookId: string
      bookTitle: string
    }

/**
 * Light cross-circle notifications feed for the Dashboard: recent
 * finishes and book-referencing messages across all the user's circles,
 * newest first, from OTHER people only. Deliberately excludes plain chat
 * with no book attached (that's real conversation, belongs in the
 * circle's own Discussion feed) and excludes the viewer's own activity —
 * "the person doesn't need to see what they said at their own home
 * page," it's not news to them. Capped at 3, not 5: a short, skimmable
 * list of what circle-mates have been up to, not a feed to scroll.
 */
export async function getRecentCircleActivity(userId: string): Promise<RecentCircleActivity[]> {
  const circles = await getMyCircles(userId)
  if (circles.length === 0) return []

  const perCircle = await Promise.all(
    circles.map(async (circle) => {
      const [showcase, messages] = await Promise.all([
        getCircleShowcase(circle.id),
        getCircleMessages(circle.id),
      ])

      const finishes: RecentCircleActivity[] = showcase
        .filter((item) => item.user_id !== userId)
        .slice(0, 5)
        .map((item) => ({
          kind: 'finished',
          id: item.id,
          createdAt: item.finished_at ?? item.updated_at,
          circleName: circle.name,
          displayName: item.profiles.display_name,
          bookId: item.book_id,
          bookTitle: item.books.title,
        }))

      const bookMoments: RecentCircleActivity[] = messages
        .filter((m) => m.book_id && m.books && m.user_id !== userId)
        .slice(0, 5)
        .map((m) => ({
          kind: 'message',
          id: m.id,
          createdAt: m.created_at,
          circleName: circle.name,
          displayName: m.profiles.display_name,
          body: m.body,
          bookId: m.book_id!,
          bookTitle: m.books!.title,
        }))

      return [...finishes, ...bookMoments]
    }),
  )

  return perCircle
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3)
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
