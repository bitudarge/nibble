import { describe, expect, it } from 'vitest'
import { cleanDescription } from './textCleanup'

describe('cleanDescription', () => {
  it('returns null for empty input', () => {
    expect(cleanDescription(null)).toBeNull()
    expect(cleanDescription(undefined)).toBeNull()
    expect(cleanDescription('')).toBeNull()
    expect(cleanDescription('   ')).toBeNull()
  })

  it('strips markdown inline links, keeping the visible text', () => {
    expect(cleanDescription('Contains [Scandal in Bohemia](https://openlibrary.org/x).')).toBe(
      'Contains Scandal in Bohemia.',
    )
  })

  it('strips markdown reference-style links and their definition lines', () => {
    const raw =
      '*Through the Looking-Glass* (1871) by Lewis Carroll. ([Wikipedia][1])\n\n  [1]: http://en.wikipedia.org/wiki/Through_the_Looking-Glass'
    expect(cleanDescription(raw)).toBe(
      'Through the Looking-Glass (1871) by Lewis Carroll. (Wikipedia)',
    )
  })

  it('drops bare footnote markers left after a link is removed', () => {
    expect(cleanDescription('It was published in installments.\\[2\\]')).toBe(
      'It was published in installments.',
    )
  })

  it('strips markdown bold/italic and heading markers, keeping the text', () => {
    expect(cleanDescription('**Bold claim** and *italic claim* here.\n### A heading')).toBe(
      'Bold claim and italic claim here.\nA heading',
    )
  })

  it('strips a markdown horizontal rule', () => {
    expect(cleanDescription('Part one.\n\n---\n\nPart two.')).toBe('Part one.\n\nPart two.')
  })

  it('strips HTML tags, turning block tags into line breaks', () => {
    expect(cleanDescription('<p>A great book.</p><br><b>Bold</b> claim.')).toBe(
      'A great book.\n\nBold claim.',
    )
  })

  it("keeps an HTML anchor's visible text and drops the link", () => {
    expect(cleanDescription('Read more <a href="http://x.com">on our site</a>.')).toBe(
      'Read more on our site.',
    )
  })

  it('decodes common HTML entities', () => {
    expect(cleanDescription('Fish &amp; chips, she said &quot;lovely&quot;.')).toBe(
      'Fish & chips, she said "lovely".',
    )
  })

  it('strips a bare leftover URL', () => {
    expect(cleanDescription('Visit https://example.com/book for more.')).toBe('Visit for more.')
  })

  it('collapses 3+ blank lines down to a single blank line', () => {
    expect(cleanDescription('One.\n\n\n\nTwo.')).toBe('One.\n\nTwo.')
  })

  it('returns null when cleaning leaves nothing behind', () => {
    expect(cleanDescription('[1]: http://example.com')).toBeNull()
  })

  it('leaves plain prose with no markup untouched', () => {
    expect(cleanDescription('A perfectly ordinary description.')).toBe(
      'A perfectly ordinary description.',
    )
  })
})
