import { MemoryFile } from '@/lib/types'
import { readFileSync, existsSync, statSync } from 'fs'
import { requireEnv } from '@/lib/env'

function readMemoryFile(label: string, filePath: string): MemoryFile | null {
  try {
    if (!existsSync(filePath)) return null
    const content = readFileSync(filePath, 'utf-8')
    const stats = statSync(filePath)
    return {
      label,
      path: filePath,
      content,
      lastModified: stats.mtime.toISOString(),
    }
  } catch {
    return null
  }
}

export async function getMemoryFiles(): Promise<MemoryFile[]> {
  const workspacePath = requireEnv('WORKSPACE_PATH')
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const todayStr = today.toISOString().slice(0, 10)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  const candidates: [string, string][] = [
    ['Long-Term Memory (Jarvis)', workspacePath + '/MEMORY.md'],
    ['Team Memory', workspacePath + '/memory/team-memory.md'],
    ['Team Intel (JSON)', workspacePath + '/memory/team-intel.json'],
    ['Daily Log (Today)', workspacePath + '/memory/' + todayStr + '.md'],
    ['Daily Log (Yesterday)', workspacePath + '/memory/' + yesterdayStr + '.md'],
  ]

  const files: MemoryFile[] = []
  for (const [label, path] of candidates) {
    const file = readMemoryFile(label, path)
    if (file) files.push(file)
  }

  return files
}
