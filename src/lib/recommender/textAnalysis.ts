import { NEGATIVE_WORDS, POSITIVE_WORDS, STOPWORDS } from './lexicon'

// Letter groups joined by an apostrophe or hyphen count as one token, so
// "found-family" and "don't" aren't split into meaningless fragments.
function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z]+(?:['-][a-z]+)*/g) ?? []
}

/**
 * A transparent, lexicon-based sentiment score in [-1, 1]. Not sentiment
 * analysis in the ML sense — just (positive word hits − negative word
 * hits) / total hits. Deliberately simple: every score is explainable by
 * pointing at the exact words that produced it (see lexicon.ts).
 */
export function analyzeSentiment(text: string): number {
  const words = tokenize(text)
  let positive = 0
  let negative = 0
  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) positive++
    if (NEGATIVE_WORDS.has(word)) negative++
  }
  const total = positive + negative
  if (total === 0) return 0
  return (positive - negative) / total
}

/**
 * Top keywords by raw frequency, excluding stopwords, sentiment words
 * (kept separate from "what it's about"), and short words. Not topic
 * modeling — just word counting. Good enough to notice a review keeps
 * saying "dragons" or "found-family" without pretending to understand it.
 */
export function extractKeywords(text: string, limit = 5): string[] {
  const counts = new Map<string, number>()
  for (const word of tokenize(text)) {
    if (word.length < 4) continue
    if (STOPWORDS.has(word) || POSITIVE_WORDS.has(word) || NEGATIVE_WORDS.has(word)) continue
    counts.set(word, (counts.get(word) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word)
}

export interface ReviewAnalysis {
  sentimentScore: number
  extractedThemes: { keywords: string[] }
}

/** Called when a review is saved — see reviews/data.ts. */
export function analyzeReviewText(body: string): ReviewAnalysis {
  return {
    sentimentScore: analyzeSentiment(body),
    extractedThemes: { keywords: extractKeywords(body) },
  }
}
