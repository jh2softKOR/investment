import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type ConsultationRecord = {
  id: string
  name: string
  contact?: string | null
  message: string
  createdAt: string
}

type NewConsultationRecord = {
  name: string
  contact?: string | null
  message: string
}

const resolveStorageFilePath = () => {
  if (process.env.CONSULTATION_STORAGE_FILE) {
    return path.resolve(process.env.CONSULTATION_STORAGE_FILE)
  }

  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const projectRoot = path.resolve(currentDir, '..')
  const storageDir = path.resolve(projectRoot, 'data')

  return path.join(storageDir, 'consultations.json')
}

const storageFilePath = resolveStorageFilePath()
const storageDir = path.dirname(storageFilePath)

const resolveMaxEntries = () => {
  const raw = process.env.CONSULTATION_MAX_ENTRIES
  if (!raw) {
    return 200
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 200
  }

  return parsed
}

const maxEntries = resolveMaxEntries()

const normalizeWhitespace = (value: string) =>
  value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()

const ensureStorageReady = async () => {
  await fs.mkdir(storageDir, { recursive: true })
  try {
    await fs.access(storageFilePath)
  } catch {
    await fs.writeFile(storageFilePath, '[]', 'utf8')
  }
}

const readAllRecords = async (): Promise<ConsultationRecord[]> => {
  await ensureStorageReady()

  try {
    const raw = await fs.readFile(storageFilePath, 'utf8')
    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    const records: ConsultationRecord[] = []

    for (const entry of parsed) {
      if (!entry) {
        continue
      }

      const { id, name, contact, message, createdAt } = entry as Partial<ConsultationRecord>

      if (typeof id !== 'string' || typeof name !== 'string' || typeof message !== 'string' || typeof createdAt !== 'string') {
        continue
      }

      records.push({
        id,
        name,
        contact: typeof contact === 'string' && contact.length > 0 ? contact : null,
        message,
        createdAt,
      })
    }

    return records
  } catch (error) {
    console.error('상담창구 데이터를 불러오는 중 오류가 발생했습니다.', error)
    return []
  }
}

const writeAllRecords = async (records: ConsultationRecord[]) => {
  const serialized = JSON.stringify(records, null, 2)
  await fs.writeFile(storageFilePath, serialized, 'utf8')
}

const getRecentConsultations = async (limit: number) => {
  const records = await readAllRecords()
  const sorted = records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  if (!Number.isFinite(limit) || limit <= 0) {
    return sorted
  }

  return sorted.slice(0, limit)
}

const appendConsultation = async (input: NewConsultationRecord) => {
  const now = new Date()
  const record: ConsultationRecord = {
    id: randomUUID(),
    name: input.name.trim(),
    contact: input.contact ? input.contact.trim() || null : null,
    message: normalizeWhitespace(input.message),
    createdAt: now.toISOString(),
  }

  const records = await readAllRecords()
  records.push(record)

  const sorted = records
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(Math.max(0, records.length - maxEntries))

  await writeAllRecords(sorted)

  return record
}

export { appendConsultation, getRecentConsultations }
export type { ConsultationRecord, NewConsultationRecord }
