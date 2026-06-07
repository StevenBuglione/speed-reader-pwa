import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'
import type { Book, BookFormat, ParsedBook } from './types'

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
})

export async function parseFile(file: File): Promise<Book> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  const buffer = await file.arrayBuffer()
  const parsed =
    extension === 'epub'
      ? await parseEpub(buffer, file.name)
      : extension === 'pdf'
        ? await parsePdf(buffer, file.name)
        : await parseText(buffer, file.name)

  const now = new Date().toISOString()
  const chapters = parsed.chapters
    .map((chapter, index) => {
      const text = normalizeText(chapter.text)
      return {
        ...chapter,
        id: `${crypto.randomUUID()}-${index}`,
        index,
        text,
        wordCount: countWords(text),
      }
    })
    .filter((chapter) => chapter.wordCount > 0)

  if (chapters.length === 0) {
    throw new Error('No readable text was found in this file.')
  }

  return {
    id: crypto.randomUUID(),
    title: parsed.title || cleanFileName(file.name),
    author: parsed.author,
    format: parsed.format,
    createdAt: now,
    updatedAt: now,
    chapters,
    wordCount: chapters.reduce((total, chapter) => total + chapter.wordCount, 0),
    currentChapter: 0,
    currentWord: 0,
  }
}

async function parseText(buffer: ArrayBuffer, fileName: string): Promise<ParsedBook> {
  const text = new TextDecoder().decode(buffer)
  return {
    title: cleanFileName(fileName),
    format: 'txt',
    chapters: splitIntoChapters(text),
  }
}

async function parsePdf(buffer: ArrayBuffer, fileName: string): Promise<ParsedBook> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).toString()
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
  const chapters = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    if (normalizeText(text)) {
      chapters.push({
        title: `Page ${pageNumber}`,
        index: pageNumber - 1,
        text,
        wordCount: countWords(text),
      })
    }
  }

  return {
    title: cleanFileName(fileName),
    format: 'pdf',
    chapters,
  }
}

async function parseEpub(buffer: ArrayBuffer, fileName: string): Promise<ParsedBook> {
  const zip = await JSZip.loadAsync(buffer)
  const container = await zip.file('META-INF/container.xml')?.async('text')
  if (!container) throw new Error('This EPUB is missing its container file.')

  const containerXml = xmlParser.parse(container)
  const rootfile = asArray(containerXml.container.rootfiles.rootfile)[0]
  const opfPath = rootfile['full-path']
  const opfText = await zip.file(opfPath)?.async('text')
  if (!opfText) throw new Error('This EPUB is missing its package document.')

  const opf = xmlParser.parse(opfText)
  const pkg = opf.package
  const metadata = pkg.metadata || {}
  const manifestItems = asArray(pkg.manifest?.item)
  const spineItems = asArray(pkg.spine?.itemref)
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''
  const byId = new Map(manifestItems.map((item) => [item.id, item]))
  const ordered = spineItems
    .map((item) => byId.get(item.idref))
    .filter(Boolean)
    .filter((item) => String(item['media-type'] || '').includes('html'))

  const chapters = []
  for (const item of ordered) {
    const href = resolveZipPath(opfDir, item.href)
    const html = await zip.file(href)?.async('text')
    if (!html) continue
    const text = htmlToText(html)
    if (normalizeText(text)) {
      chapters.push({
        title: item.title || `Chapter ${chapters.length + 1}`,
        index: chapters.length,
        text,
        wordCount: countWords(text),
      })
    }
  }

  return {
    title: firstText(metadata['dc:title']) || cleanFileName(fileName),
    author: firstText(metadata['dc:creator']),
    format: 'epub',
    chapters,
  }
}

function splitIntoChapters(text: string) {
  const blocks = normalizeText(text)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
  const chunkSize = 1800
  const chapters = []
  let current = ''
  for (const block of blocks.length ? blocks : [text]) {
    if ((current + block).split(/\s+/).length > chunkSize && current) {
      chapters.push(current)
      current = block
    } else {
      current = `${current}\n\n${block}`.trim()
    }
  }
  if (current) chapters.push(current)

  return chapters.map((chapter, index) => ({
    title: chapters.length === 1 ? 'Text' : `Section ${index + 1}`,
    index,
    text: chapter,
    wordCount: countWords(chapter),
  }))
}

function htmlToText(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, style, nav').forEach((node) => node.remove())
  doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote').forEach((node) => {
    node.append(document.createTextNode('\n\n'))
  })
  return doc.body.textContent || ''
}

function normalizeText(text: string) {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function countWords(text: string) {
  return normalizeText(text).split(/\s+/).filter(Boolean).length
}

export function wordsForBook(book: Book) {
  return book.chapters.flatMap((chapter) => normalizeText(chapter.text).split(/\s+/).filter(Boolean))
}

export function chapterOffset(book: Book, chapterIndex: number) {
  return book.chapters
    .slice(0, chapterIndex)
    .reduce((total, chapter) => total + chapter.wordCount, 0)
}

export function locateWord(book: Book, globalWordIndex: number) {
  let remaining = Math.max(0, globalWordIndex)
  for (const chapter of book.chapters) {
    if (remaining <= chapter.wordCount) {
      return { currentChapter: chapter.index, currentWord: remaining }
    }
    remaining -= chapter.wordCount
  }
  const last = book.chapters[book.chapters.length - 1]
  return { currentChapter: last.index, currentWord: Math.max(0, last.wordCount - 1) }
}

function cleanFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
}

function resolveZipPath(base: string, href: string) {
  const stack = base.split('/').filter(Boolean)
  for (const part of href.split('/')) {
    if (part === '..') stack.pop()
    else if (part !== '.') stack.push(part)
  }
  return stack.join('/')
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function firstText(value: unknown): string | undefined {
  const first = asArray(value)[0]
  if (!first) return undefined
  if (typeof first === 'string') return first
  if (typeof first === 'object' && '#text' in first) return String(first['#text'])
  return undefined
}

export function formatLabel(format: BookFormat) {
  return format.toUpperCase()
}
