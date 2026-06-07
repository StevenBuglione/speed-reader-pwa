export type BookFormat = 'sample' | 'txt' | 'epub' | 'pdf'

export type ThemeName = 'paper' | 'ivory' | 'night'

export interface Chapter {
  id: string
  title: string
  index: number
  text: string
  wordCount: number
}

export interface Book {
  id: string
  title: string
  author?: string
  format: BookFormat
  createdAt: string
  updatedAt: string
  wordCount: number
  chapters: Chapter[]
  currentChapter: number
  currentWord: number
}

export interface ReadingSettings {
  id: 'default'
  theme: ThemeName
  accentColor: string
  fontSize: number
  lineHeight: number
  rsvpWpm: number
  chunkSize: number
}

export interface PracticeSession {
  id: string
  bookId: string
  bookTitle: string
  startedAt: string
  durationMs: number
  wordsRead: number
  targetWpm: number
  actualWpm: number
  comprehensionRating: number
  notes: string
}

export interface ParsedBook {
  title: string
  author?: string
  format: BookFormat
  chapters: Omit<Chapter, 'id'>[]
}
