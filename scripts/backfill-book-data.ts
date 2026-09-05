// One-off maintenance script: fixes existing `books` rows that predate (or
// were written before) the round 7.2 description-cleanup and page-count
// fixes, directly against the live database. New rows already get clean
// descriptions and a page-count attempt from `enrichBook` itself — this is
// only for what's already stored.
//
// Run with:
//   VITE_SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> \
//     npx tsx scripts/backfill-book-data.ts
// Neither value is committed or printed by this script — pass both as env
// vars only (VITE_SUPABASE_URL is not itself secret, but is required
// alongside the key since this script doesn't load .env).
import { createClient } from '@supabase/supabase-js'
import { cleanDescription } from '../src/lib/books/textCleanup'
import { fetchOpenLibraryPageCount } from '../src/lib/books/openLibrary'

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  throw new Error('Need VITE_SUPABASE_URL (from .env) and SUPABASE_SERVICE_ROLE_KEY env vars.')
}

const db = createClient(url, serviceKey)

interface BookRow {
  id: string
  open_library_id: string
  page_count: number | null
  metadata: { description?: string | null; [key: string]: unknown }
}

async function main() {
  const { data, error } = await db.from('books').select('id, open_library_id, page_count, metadata')
  if (error) throw error
  const books = (data ?? []) as BookRow[]
  console.log(`Checking ${books.length} books…`)

  let cleanedCount = 0
  let pageCountCount = 0
  let failedCount = 0

  for (const book of books) {
    const update: Record<string, unknown> = {}

    const rawDescription = book.metadata.description ?? null
    const cleaned = cleanDescription(rawDescription)
    if (cleaned !== rawDescription) {
      update.metadata = { ...book.metadata, description: cleaned }
    }

    if (!book.page_count) {
      const pageCount = await fetchOpenLibraryPageCount(book.open_library_id)
      if (pageCount) update.page_count = pageCount
    }

    if (Object.keys(update).length === 0) continue

    const { error: updateError } = await db.from('books').update(update).eq('id', book.id)
    if (updateError) {
      console.error(`  failed to update ${book.id}: ${updateError.message}`)
      failedCount++
      continue
    }
    if (update.metadata) cleanedCount++
    if (update.page_count) pageCountCount++
  }

  console.log(
    `Done. Cleaned ${cleanedCount} description(s), filled in ${pageCountCount} page count(s), ${failedCount} failure(s).`,
  )
}

void main()
