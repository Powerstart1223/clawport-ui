import { existsSync, readFileSync, statSync, readdirSync } from 'fs'
import { join } from 'path'
import { requireEnv } from '@/lib/env'

export type NetdocsState = {
  schema?: number
  runStartedAt?: string
  updatedAt?: string
  currentClient?: string | null
  currentFolder?: string | null
  currentPath?: string | null
  lastTitle?: string | null
  counts?: { downloaded?: number; skippedOver50mb?: number; errors?: number }
  paths?: { dest?: string; skipLog?: string }
}

export type TailLine = { line: string; ts?: string }

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function getNetdocsPaths() {
  const workspacePath = requireEnv('WORKSPACE_PATH')
  return {
    workspacePath,
    progressPath: join(workspacePath, 'netdocs_progress.json'),
    seenPath: join(workspacePath, 'netdocs_seen.jsonl'),
    skipPath: join(workspacePath, 'netdocs_skipped_over_50mb.txt'),
    controlPath: join(workspacePath, 'netdocs_control.json'),
    eventsPath: join(workspacePath, 'netdocs_events.jsonl'),
    lastShotPath: join(workspacePath, 'netdocs_last.png'),
    statusPath: join(workspacePath, 'netdocs_status.json'),
  }
}

export function readNetdocsState(): { state: NetdocsState | null; found: boolean; raw?: string } {
  const { progressPath } = getNetdocsPaths()
  if (!existsSync(progressPath)) return { state: null, found: false }
  const raw = readFileSync(progressPath, 'utf-8')
  return { state: safeJsonParse<NetdocsState>(raw), found: true, raw }
}

export function tailFile(path: string, maxLines: number): string[] {
  if (!existsSync(path)) return []
  const raw = readFileSync(path, 'utf-8')
  const lines = raw.split(/\r?\n/).filter(Boolean)
  return lines.slice(-maxLines)
}

export function listRecentFiles(dirPath: string, limit = 20) {
  if (!existsSync(dirPath)) return []
  const entries = readdirSync(dirPath)
    .map((name) => {
      const full = join(dirPath, name)
      try {
        const st = statSync(full)
        if (!st.isFile()) return null
        return { name, path: full, lastModified: st.mtime.toISOString(), sizeBytes: st.size }
      } catch {
        return null
      }
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))

  entries.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
  return entries.slice(0, limit)
}
