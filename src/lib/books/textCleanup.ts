/**
 * Google Books' and Open Library's description fields are free-text jacket
 * copy, not authored for this app, and regularly carry raw markup that
 * BookHero renders as plain text (never `dangerouslySetInnerHTML` — this
 * app doesn't trust external content that far), so any of it shows up as
 * literal clutter on the page instead of being interpreted: Markdown links
 * (`[text](url)`), reference-style footnotes (`[1]: http://...`), bold/
 * heading markers, and — mainly from Google Books, when its `description`
 * carries HTML instead of Markdown — tags like `<p>`/`<br>`/`<a href>`.
 * Confirmed directly against the live `books` table: real rows have
 * descriptions like "From \[wikipedia\](https://en.wikipedia.org/...)"
 * and reference-style link lists, exactly the "links and stuff" the owner
 * flagged in the About section. This strips all of that down to plain
 * paragraphs, keeping a link's visible text but dropping the URL.
 */
export function cleanDescription(raw: string | null | undefined): string | null {
  if (!raw) return null

  let text = raw

  // Markdown reference-style link definitions ("[1]: http://...") are pure
  // footnote plumbing with no readable content — drop the whole line.
  text = text.replace(/^[ \t]*\\?\[\^?\d+\\?\]:\s*\S+.*$/gim, '')

  // Markdown inline links: keep the visible text, drop the URL.
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')

  // Markdown reference-style link usages ("[Wikipedia][1]"), pointing at a
  // definition line already dropped above — keep just the visible text.
  text = text.replace(/\[([^\]]+)\]\[\^?\d+\]/g, '$1')

  // Leftover footnote markers ("[1]", "\[2\]") once their definition or
  // link is gone — they'd otherwise point at nothing.
  text = text.replace(/\\?\[\^?\d+\\?\]/g, '')

  // Markdown heading/emphasis syntax — keep the text, drop the markers.
  text = text.replace(/^#{1,6}\s*/gm, '')
  text = text.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
  text = text.replace(/^-{3,}\s*$/gm, '')

  // HTML (mainly from Google Books): block tags become line breaks before
  // the rest is stripped, so removing tags doesn't run every paragraph
  // into one line; anchors keep their visible text and drop the link.
  text = text
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n\n')
    .replace(/<\s*\/(li|div)\s*>/gi, '\n')
    .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/<[^>]+>/g, '')

  // The handful of HTML entities that actually show up in practice.
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")

  // A bare URL left over once its surrounding link markup is gone.
  text = text.replace(/https?:\/\/\S+/gi, '')

  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text.length > 0 ? text : null
}
