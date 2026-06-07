import type { Book } from './types'

const sampleText = `
Speed reading is most useful when it is treated as a practice tool, not a promise of impossible comprehension. The goal is to learn how pace feels, how attention drifts, and how much meaning you can carry forward at different speeds.

Traditional reading lets your eyes pause, move backward, and gather context from surrounding words. Rapid serial visual presentation, or RSVP, removes many of those movements by showing words in one place. That can feel wonderfully focused, especially for short bursts, but it also changes how comprehension works.

Use this sample to try the flow. Start around three hundred words per minute and notice whether the sentences still feel alive in your mind. Then move upward slowly. If the words become noise, lower the pace. A good session is not the fastest one; it is the one where speed and understanding stay connected.

After each practice round, write one sentence about what you remember. That tiny reflection keeps the app honest. It turns speed practice into reading practice.
`.trim()

export const sampleBook: Book = {
  id: 'sample-practice-reader',
  title: 'A Measured Start',
  author: 'Speed Reader',
  format: 'sample',
  createdAt: '2026-06-07T00:00:00.000Z',
  updatedAt: '2026-06-07T00:00:00.000Z',
  wordCount: sampleText.split(/\s+/).length,
  currentChapter: 0,
  currentWord: 0,
  chapters: [
    {
      id: 'sample-chapter-1',
      title: 'Practice Without Hype',
      index: 0,
      text: sampleText,
      wordCount: sampleText.split(/\s+/).length,
    },
  ],
}
