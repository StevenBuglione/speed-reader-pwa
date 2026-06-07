import { openDB, type DBSchema } from 'idb'
import { sampleBook } from './sampleBook'
import type { Book, PracticeSession, ReadingSettings } from './types'

interface SpeedReaderDb extends DBSchema {
  books: {
    key: string
    value: Book
    indexes: { 'by-updated': string }
  }
  sessions: {
    key: string
    value: PracticeSession
    indexes: { 'by-started': string; 'by-book': string }
  }
  settings: {
    key: string
    value: ReadingSettings
  }
  meta: {
    key: string
    value: { id: string; value: string | boolean | number }
  }
}

const defaultSettings: ReadingSettings = {
  id: 'default',
  theme: 'paper',
  fontSize: 20,
  lineHeight: 1.75,
  rsvpWpm: 300,
  chunkSize: 1,
}

const dbPromise = openDB<SpeedReaderDb>('speed-reader-pwa', 1, {
  upgrade(db) {
    const books = db.createObjectStore('books', { keyPath: 'id' })
    books.createIndex('by-updated', 'updatedAt')
    const sessions = db.createObjectStore('sessions', { keyPath: 'id' })
    sessions.createIndex('by-started', 'startedAt')
    sessions.createIndex('by-book', 'bookId')
    db.createObjectStore('settings', { keyPath: 'id' })
    db.createObjectStore('meta', { keyPath: 'id' })
  },
})

export async function seedSampleBook() {
  const db = await dbPromise
  const seeded = await db.get('meta', 'sampleSeeded')
  if (!seeded) {
    await db.put('books', sampleBook)
    await db.put('meta', { id: 'sampleSeeded', value: true })
  }
}

export async function getBooks() {
  await seedSampleBook()
  const db = await dbPromise
  const books = await db.getAllFromIndex('books', 'by-updated')
  return books.reverse()
}

export async function saveBook(book: Book) {
  const db = await dbPromise
  await db.put('books', { ...book, updatedAt: new Date().toISOString() })
}

export async function deleteBook(id: string) {
  const db = await dbPromise
  await db.delete('books', id)
}

export async function getSettings() {
  const db = await dbPromise
  const settings = await db.get('settings', 'default')
  if (settings) return settings
  await db.put('settings', defaultSettings)
  return defaultSettings
}

export async function saveSettings(settings: ReadingSettings) {
  const db = await dbPromise
  await db.put('settings', settings)
}

export async function getSessions() {
  const db = await dbPromise
  const sessions = await db.getAllFromIndex('sessions', 'by-started')
  return sessions.reverse()
}

export async function saveSession(session: PracticeSession) {
  const db = await dbPromise
  await db.put('sessions', session)
}
