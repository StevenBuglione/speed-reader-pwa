import {
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  FilePlus2,
  Gauge,
  Library,
  Palette,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  chapterOffset,
  formatLabel,
  locateWord,
  parseFile,
  wordsForBook,
} from './bookParser'
import {
  deleteBook,
  getBooks,
  getSessions,
  getSettings,
  saveBook,
  saveSession,
  saveSettings,
} from './storage'
import type { Book, PracticeSession, ReadingSettings } from './types'

type View = 'library' | 'reader' | 'speed' | 'stats'
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const wpmPresets = [250, 300, 400, 500, 600, 750, 900]
const challengeDurationMs = 150000
const accentPresets = ['#b7f56a', '#64d8cb', '#ffcf5a', '#ff7a90', '#a78bfa']

export default function App() {
  const [books, setBooks] = useState<Book[]>([])
  const [sessions, setSessions] = useState<PracticeSession[]>([])
  const [settings, setSettings] = useState<ReadingSettings | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<View>('library')
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [query, setQuery] = useState('')
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    void refresh()
    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  async function refresh() {
    const [nextBooks, nextSettings, nextSessions] = await Promise.all([
      getBooks(),
      getSettings(),
      getSessions(),
    ])
    setBooks(nextBooks)
    setSettings(nextSettings)
    setSessions(nextSessions)
    setSelectedId((current) => current ?? nextBooks[0]?.id ?? null)
  }

  const selectedBook = books.find((book) => book.id === selectedId) ?? books[0] ?? null

  async function updateBook(book: Book) {
    await saveBook(book)
    setBooks((current) =>
      current.map((item) => (item.id === book.id ? { ...book, updatedAt: new Date().toISOString() } : item)),
    )
  }

  async function updateSettings(next: ReadingSettings) {
    setSettings(next)
    await saveSettings(next)
  }

  async function handleImport(files: FileList | null) {
    if (!files?.length) return
    setIsImporting(true)
    setImportError('')
    try {
      const imported = []
      for (const file of Array.from(files)) {
        const book = await parseFile(file)
        await saveBook(book)
        imported.push(book)
      }
      await refresh()
      setSelectedId(imported[0]?.id ?? selectedId)
      setView('library')
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'That file could not be imported.')
    } finally {
      setIsImporting(false)
    }
  }

  async function handleDelete(book: Book) {
    await deleteBook(book.id)
    const next = books.filter((item) => item.id !== book.id)
    setBooks(next)
    if (selectedId === book.id) setSelectedId(next[0]?.id ?? null)
  }

  async function promptInstall() {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  if (!settings) {
    return (
      <main className="loading-screen">
        <div className="logo-mark">SR</div>
        <p>Preparing your private reading room...</p>
      </main>
    )
  }

  return (
    <div className="app" style={{ '--accent': settings.accentColor } as CSSProperties}>
      <aside className="sidebar" aria-label="Primary">
        <button className="brand" onClick={() => setView('library')} type="button">
          <span className="logo-mark">SR</span>
          <span>
            <strong>Speed Reader</strong>
            <small>Read, pace, remember</small>
          </span>
        </button>
        <nav className="nav-tabs">
          <button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')} type="button">
            <Library size={18} /> Library
          </button>
          <button
            className={view === 'reader' ? 'active' : ''}
            disabled={!selectedBook}
            onClick={() => setView('reader')}
            type="button"
          >
            <BookOpen size={18} /> Reader
          </button>
          <button
            className={view === 'speed' ? 'active' : ''}
            disabled={!selectedBook}
            onClick={() => setView('speed')}
            type="button"
          >
            <Gauge size={18} /> Practice
          </button>
          <button className={view === 'stats' ? 'active' : ''} onClick={() => setView('stats')} type="button">
            <BarChart3 size={18} /> Stats
          </button>
        </nav>
        <div className="sidebar-panel">
          {installPrompt ? (
            <button className="secondary full" onClick={promptInstall} type="button">
              <Download size={16} /> Add to home screen
            </button>
          ) : (
            <p className="muted compact">Local books. Offline shell. No account.</p>
          )}
        </div>
      </aside>

      <main className="workspace">
        <TopBar
          book={selectedBook}
          settings={settings}
          onSettings={updateSettings}
          onSpeed={() => setView('speed')}
        />

        {view === 'library' && (
          <LibraryView
            books={books}
            selectedId={selectedBook?.id ?? null}
            isImporting={isImporting}
            importError={importError}
            onImport={handleImport}
            onOpen={(book) => {
              setSelectedId(book.id)
              setView('reader')
            }}
            onPractice={(book) => {
              setSelectedId(book.id)
              setView('speed')
            }}
            onDelete={handleDelete}
          />
        )}

        {view === 'reader' && selectedBook && (
          <ReaderView
            book={selectedBook}
            query={query}
            settings={settings}
            onQuery={setQuery}
            onBookChange={updateBook}
            onPractice={() => setView('speed')}
          />
        )}

        {view === 'speed' && selectedBook && (
          <SpeedView
            book={selectedBook}
            settings={settings}
            onBookChange={updateBook}
            onSettings={updateSettings}
            onSession={async (session) => {
              await saveSession(session)
              setSessions((current) => [session, ...current])
            }}
            onReader={() => setView('reader')}
          />
        )}

        {view === 'stats' && <StatsView books={books} sessions={sessions} />}
      </main>
    </div>
  )
}

function TopBar({
  book,
  settings,
  onSettings,
  onSpeed,
}: {
  book: Book | null
  settings: ReadingSettings
  onSettings: (settings: ReadingSettings) => void
  onSpeed: () => void
}) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Current book</p>
        <h1>{book ? book.title : 'Build your library'}</h1>
      </div>
      <div className="top-actions">
        <AccentMenu settings={settings} onSettings={onSettings} />
        <button className="primary" disabled={!book} onClick={onSpeed} type="button">
          <Gauge size={17} /> Practice
        </button>
      </div>
    </header>
  )
}

function AccentMenu({
  settings,
  onSettings,
}: {
  settings: ReadingSettings
  onSettings: (settings: ReadingSettings) => void
}) {
  return (
    <details className="accent-menu">
      <summary aria-label="Customize accent color">
        <Palette size={16} />
      </summary>
      <div className="accent-popover">
        <span>Accent</span>
        <div className="accent-swatches" aria-label="Accent color presets">
          {accentPresets.map((color) => (
            <button
              aria-label={`Use accent ${color}`}
              className={settings.accentColor.toLowerCase() === color ? 'active' : ''}
              key={color}
              onClick={(event) => {
                void onSettings({ ...settings, accentColor: color })
                event.currentTarget.closest('details')?.removeAttribute('open')
              }}
              style={{ backgroundColor: color }}
              type="button"
            />
          ))}
          <label className="custom-color" aria-label="Custom accent color">
            <input
              onChange={(event) => void onSettings({ ...settings, accentColor: event.target.value })}
              type="color"
              value={settings.accentColor}
            />
          </label>
        </div>
      </div>
    </details>
  )
}

function LibraryView({
  books,
  selectedId,
  isImporting,
  importError,
  onImport,
  onOpen,
  onPractice,
  onDelete,
}: {
  books: Book[]
  selectedId: string | null
  isImporting: boolean
  importError: string
  onImport: (files: FileList | null) => void
  onOpen: (book: Book) => void
  onPractice: (book: Book) => void
  onDelete: (book: Book) => void
}) {
  return (
    <section className="content-stack">
      <div className="import-band">
        <div>
          <p className="eyebrow">Local ebook library</p>
          <h2>Upload EPUB, TXT, or text-based PDF files.</h2>
          <p>Try the bundled sample, then add your own books. Nothing is uploaded to a server.</p>
        </div>
        <label className="upload-button">
          <Upload size={18} />
          {isImporting ? 'Importing...' : 'Import books'}
          <input
            accept=".epub,.txt,.pdf,text/plain,application/epub+zip,application/pdf"
            disabled={isImporting}
            multiple
            onChange={(event) => void onImport(event.target.files)}
            type="file"
          />
        </label>
      </div>
      {importError && (
        <div className="notice error">
          <X size={18} />
          <span>{importError}</span>
        </div>
      )}
      <div className="book-grid">
        {books.map((book) => (
          <article className={`book-card ${book.id === selectedId ? 'selected' : ''}`} key={book.id}>
            <div className="book-cover">
              <span>{book.title.slice(0, 1).toUpperCase()}</span>
            </div>
            <div className="book-card-body">
              <div className="book-meta-row">
                <span className="format-pill">{formatLabel(book.format)}</span>
                <span>{Math.round(book.wordCount / 100) / 10}k words</span>
              </div>
              <h3>{book.title}</h3>
              <p>{book.author || 'Unknown author'}</p>
              <ProgressBar value={bookProgress(book)} />
              <div className="card-actions">
                <button className="primary" onClick={() => onOpen(book)} type="button">
                  <BookOpen size={16} /> Read
                </button>
                <button className="secondary" onClick={() => onPractice(book)} type="button">
                  <Gauge size={16} /> Practice
                </button>
                {book.format !== 'sample' && (
                  <button className="icon-button" onClick={() => void onDelete(book)} title="Delete book" type="button">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
        <label className="empty-import">
          <FilePlus2 size={24} />
          <span>Add another book</span>
          <input
            accept=".epub,.txt,.pdf,text/plain,application/epub+zip,application/pdf"
            disabled={isImporting}
            multiple
            onChange={(event) => void onImport(event.target.files)}
            type="file"
          />
        </label>
      </div>
    </section>
  )
}

function ReaderView({
  book,
  query,
  settings,
  onQuery,
  onBookChange,
  onPractice,
}: {
  book: Book
  query: string
  settings: ReadingSettings
  onQuery: (query: string) => void
  onBookChange: (book: Book) => void
  onPractice: () => void
}) {
  const chapter = book.chapters[book.currentChapter] ?? book.chapters[0]
  const paragraphs = highlightText(chapter.text, query)
  const progress = bookProgress(book)

  function moveChapter(delta: number) {
    const next = Math.min(book.chapters.length - 1, Math.max(0, book.currentChapter + delta))
    void onBookChange({ ...book, currentChapter: next, currentWord: 0 })
  }

  return (
    <section className="reader-shell">
      <div className="reader-toolbar">
        <button className="secondary" disabled={book.currentChapter === 0} onClick={() => moveChapter(-1)} type="button">
          <ChevronLeft size={17} /> Previous
        </button>
        <div className="search-box">
          <Search size={16} />
          <input
            aria-label="Search current chapter"
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search chapter"
            value={query}
          />
        </div>
        <button
          className="secondary"
          disabled={book.currentChapter >= book.chapters.length - 1}
          onClick={() => moveChapter(1)}
          type="button"
        >
          Next <ChevronRight size={17} />
        </button>
      </div>

      <article
        className="reader-page"
        style={{
          fontSize: `${settings.fontSize}px`,
          lineHeight: settings.lineHeight,
        }}
      >
        <div className="chapter-kicker">
          <span>
            Chapter {chapter.index + 1} of {book.chapters.length}
          </span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <h2>{chapter.title}</h2>
        {paragraphs.map((paragraph, index) => (
          <p key={`${chapter.id}-${index}`} dangerouslySetInnerHTML={{ __html: paragraph }} />
        ))}
      </article>

      <div className="reader-footer">
        <ProgressBar value={progress} />
        <button className="primary" onClick={onPractice} type="button">
          <Gauge size={17} /> Practice from here
        </button>
      </div>
    </section>
  )
}

function SpeedView({
  book,
  settings,
  onBookChange,
  onSettings,
  onSession,
  onReader,
}: {
  book: Book
  settings: ReadingSettings
  onBookChange: (book: Book) => void
  onSettings: (settings: ReadingSettings) => void
  onSession: (session: PracticeSession) => void
  onReader: () => void
}) {
  const words = useMemo(() => wordsForBook(book), [book])
  const bookStartIndex = chapterOffset(book, book.currentChapter) + book.currentWord
  const [index, setIndex] = useState(bookStartIndex)
  const [sessionStartIndex, setSessionStartIndex] = useState(bookStartIndex)
  const [playing, setPlaying] = useState(false)
  const [challenge, setChallenge] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [rating, setRating] = useState(4)
  const [notes, setNotes] = useState('')
  const [wordsReadThisRun, setWordsReadThisRun] = useState(0)
  const timeoutRef = useRef<number | null>(null)
  const runAnchorRef = useRef<{ at: number; index: number } | null>(null)
  const effectiveWpm = challenge && startedAt ? Math.min(900, 300 + ((Date.now() - startedAt) / challengeDurationMs) * 600) : settings.rsvpWpm
  const currentWord = words[index] || 'Done'
  const progress = words.length ? (index / words.length) * 100 : 0

  useEffect(() => {
    if (!playing) return
    const now = Date.now()
    if (!startedAt) setStartedAt(now)
    if (!runAnchorRef.current) runAnchorRef.current = { at: now, index }
    const delay = 100
    timeoutRef.current = window.setTimeout(() => {
      const anchor = runAnchorRef.current ?? { at: now, index }
      const elapsedMinutes = (Date.now() - anchor.at) / 60000
      const elapsedWords = Math.max(1, Math.floor(elapsedMinutes * effectiveWpm))
      setIndex(() => {
        const nextIndex = anchor.index + elapsedWords * settings.chunkSize
        setWordsReadThisRun(Math.max(0, nextIndex - sessionStartIndex))
        if (nextIndex >= words.length - 1) {
          setPlaying(false)
          setReviewOpen(true)
          return words.length - 1
        }
        return nextIndex
      })
    }, delay)
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [effectiveWpm, index, playing, sessionStartIndex, settings.chunkSize, startedAt, words.length])

  useEffect(() => {
    setIndex(bookStartIndex)
    setSessionStartIndex(bookStartIndex)
    setStartedAt(null)
    setWordsReadThisRun(0)
    runAnchorRef.current = null
    setPlaying(false)
  }, [book.id])

  function persistPosition(nextIndex = index) {
    const location = locateWord(book, nextIndex)
    void onBookChange({ ...book, ...location })
  }

  function completeSession() {
    const durationMs = startedAt ? Date.now() - startedAt : 0
    const wordsRead = Math.max(wordsReadThisRun, index - sessionStartIndex, 0)
    const actualWpm = durationMs ? Math.round(wordsRead / (durationMs / 60000)) : 0
    onSession({
      id: crypto.randomUUID(),
      bookId: book.id,
      bookTitle: book.title,
      startedAt: new Date(startedAt ?? Date.now()).toISOString(),
      durationMs,
      wordsRead,
      targetWpm: Math.round(effectiveWpm),
      actualWpm,
      comprehensionRating: rating,
      notes,
    })
    persistPosition(index)
    setReviewOpen(false)
    setStartedAt(null)
    setWordsReadThisRun(0)
    runAnchorRef.current = null
    setNotes('')
  }

  return (
    <section className="speed-layout">
      <div className="speed-stage">
        <div className="speed-meta">
          <span>{book.title}</span>
          <span>{Math.round(effectiveWpm)} WPM</span>
        </div>
        <div className="rsvp-word" aria-live="polite">
          <span className="orp">{currentWord.slice(0, Math.max(1, Math.floor(currentWord.length * 0.35)))}</span>
          <span>{currentWord.slice(Math.max(1, Math.floor(currentWord.length * 0.35)))}</span>
        </div>
        <ProgressBar value={progress} />
        <div className="speed-controls">
          <button
            className="secondary"
            onClick={() => {
              setPlaying(false)
              setIndex(sessionStartIndex)
              setWordsReadThisRun(0)
              runAnchorRef.current = null
              setStartedAt(null)
            }}
            type="button"
          >
            <RotateCcw size={17} /> Reset
          </button>
          <button
            className="play-button"
            onClick={() => {
              if (playing) {
                persistPosition(index)
                runAnchorRef.current = null
              } else {
                runAnchorRef.current = { at: Date.now(), index }
              }
              setPlaying(!playing)
            }}
            type="button"
          >
            {playing ? <Pause size={24} /> : <Play size={24} />}
            {playing ? 'Pause' : 'Start'}
          </button>
          <button
            className="secondary"
            onClick={() => {
              persistPosition(index)
              onReader()
            }}
            type="button"
          >
            <BookOpen size={17} /> Reader
          </button>
        </div>
      </div>

      <aside className="practice-panel">
        <div>
          <p className="eyebrow">Speed settings</p>
          <h2>Find the fastest pace that still leaves a memory.</h2>
        </div>
        <div className="preset-grid">
          {wpmPresets.map((preset) => (
            <button
              className={settings.rsvpWpm === preset && !challenge ? 'active' : ''}
              key={preset}
              onClick={() => {
                setChallenge(false)
                void onSettings({ ...settings, rsvpWpm: preset })
              }}
              type="button"
            >
              {preset}
            </button>
          ))}
        </div>
        <label className="range-control">
          <span>Reader font size</span>
          <input
            max="32"
            min="16"
            onChange={(event) => void onSettings({ ...settings, fontSize: Number(event.target.value) })}
            type="range"
            value={settings.fontSize}
          />
        </label>
        <label className="toggle-row">
          <input checked={challenge} onChange={(event) => setChallenge(event.target.checked)} type="checkbox" />
          <span>
            <strong>Challenge ramp</strong>
            <small>300 to 900 WPM over 2.5 minutes</small>
          </span>
        </label>
        <button
          className="primary full"
          onClick={() => {
            setPlaying(false)
            runAnchorRef.current = null
            setReviewOpen(true)
          }}
          type="button"
        >
          <Sparkles size={17} /> Finish session
        </button>
      </aside>

      {reviewOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <button className="icon-button close" onClick={() => setReviewOpen(false)} type="button">
              <X size={18} />
            </button>
            <p className="eyebrow">Comprehension check</p>
            <h2>What stayed with you?</h2>
            <label className="range-control">
              <span>Understanding: {rating}/5</span>
              <input max="5" min="1" onChange={(event) => setRating(Number(event.target.value))} type="range" value={rating} />
            </label>
            <textarea
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Write one sentence you remember."
              value={notes}
            />
            <button className="primary full" onClick={completeSession} type="button">
              Save practice session
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function StatsView({ books, sessions }: { books: Book[]; sessions: PracticeSession[] }) {
  const totalWords = sessions.reduce((total, session) => total + session.wordsRead, 0)
  const totalMinutes = sessions.reduce((total, session) => total + session.durationMs / 60000, 0)
  const bestWpm = Math.max(0, ...sessions.map((session) => session.actualWpm))
  const averageComprehension = sessions.length
    ? sessions.reduce((total, session) => total + session.comprehensionRating, 0) / sessions.length
    : 0

  return (
    <section className="content-stack">
      <div className="metrics-grid">
        <Metric label="Books" value={books.length.toString()} />
        <Metric label="Practice words" value={totalWords.toLocaleString()} />
        <Metric label="Practice time" value={`${Math.round(totalMinutes)}m`} />
        <Metric label="Best actual WPM" value={bestWpm.toString()} />
        <Metric label="Avg. understanding" value={averageComprehension ? `${averageComprehension.toFixed(1)}/5` : '-'} />
      </div>
      <div className="session-list">
        <div>
          <p className="eyebrow">Recent practice</p>
          <h2>Speed only counts when memory comes with it.</h2>
        </div>
        {sessions.length === 0 ? (
          <p className="muted">Finish a speed-practice session to see your history here.</p>
        ) : (
          sessions.map((session) => (
            <article className="session-row" key={session.id}>
              <div>
                <strong>{session.bookTitle}</strong>
                <span>{new Date(session.startedAt).toLocaleString()}</span>
              </div>
              <span>{session.wordsRead.toLocaleString()} words</span>
              <span>{session.actualWpm} WPM</span>
              <span>{session.comprehensionRating}/5</span>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress" aria-label={`${Math.round(value)} percent complete`}>
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

function bookProgress(book: Book) {
  const read = chapterOffset(book, book.currentChapter) + book.currentWord
  return book.wordCount ? (read / book.wordCount) * 100 : 0
}

function highlightText(text: string, query: string) {
  const escaped = escapeHtml(text)
  const paragraphs = escaped.split(/\n{2,}/).filter(Boolean)
  if (!query.trim()) return paragraphs
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return paragraphs.map((paragraph) =>
    paragraph.replace(new RegExp(safeQuery, 'gi'), (match) => `<mark>${match}</mark>`),
  )
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
