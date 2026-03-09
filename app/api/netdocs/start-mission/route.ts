import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-error'
import { getNetdocsPaths } from '@/lib/netdocs'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { spawn, execFileSync } from 'child_process'

// Orchestrate the whole "Start Mission" flow server-side.
// NOTE: We avoid fetch()ing our own API routes (can deadlock/hang in some Next setups).

export const runtime = 'nodejs'

function isAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function readPid(p: string): number | null {
  try {
    if (!existsSync(p)) return null
    const raw = readFileSync(p, 'utf-8').trim()
    const pid = Number(raw)
    if (!pid || Number.isNaN(pid)) return null
    return pid
  } catch {
    return null
  }
}

function getOpenclawBin(): { exe: string; argsPrefix: string[] } {
  const candidates = [
    process.env.OPENCLAW_CLI_PATH,
    'C:\\Users\\SJK\\AppData\\Roaming\\npm\\openclaw.cmd',
    'C:\\Users\\SJK\\AppData\\Roaming\\npm\\openclaw',
    'openclaw',
  ].filter(Boolean) as string[]

  for (const c of candidates) {
    if (c === 'openclaw') return { exe: 'openclaw', argsPrefix: [] }
    try {
      if (existsSync(c)) {
        if (c.toLowerCase().endsWith('.cmd')) return { exe: 'cmd.exe', argsPrefix: ['/c', c] }
        return { exe: c, argsPrefix: [] }
      }
    } catch {}
  }
  return { exe: 'openclaw', argsPrefix: [] }
}

function runOpenclaw(args: string[]) {
  const bin = getOpenclawBin()
  const stdout = execFileSync(bin.exe, [...bin.argsPrefix, ...args], {
    encoding: 'utf-8',
    windowsHide: true,
  })
  return stdout || ''
}

function ensureRunner(workspacePath: string) {
  const pidFile = join(workspacePath, 'netdocs_runner.pid')
  const existing = readPid(pidFile)
  if (existing && isAlive(existing)) return { ok: true, running: true, pid: existing }

  const script = join(workspacePath, 'netdocs_runner.py')
  const child = spawn('python', [script, '--loop'], { cwd: workspacePath, detached: true, stdio: 'ignore' })
  child.unref()
  writeFileSync(pidFile, String(child.pid), { encoding: 'utf-8' })
  return { ok: true, running: true, pid: child.pid }
}

function ensureDownloader(workspacePath: string) {
  const pidFile = join(workspacePath, 'netdocs_downloader.pid')
  const existing = readPid(pidFile)
  if (existing && isAlive(existing)) return { ok: true, running: true, pid: existing }

  const script = join(workspacePath, 'netdocs_downloader.py')
  const child = spawn('python', [script, '--loop'], { cwd: workspacePath, detached: true, stdio: 'ignore' })
  child.unref()
  writeFileSync(pidFile, String(child.pid), { encoding: 'utf-8' })
  return { ok: true, running: true, pid: child.pid }
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function ensureBrowserAndTabs() {
  // Start browser (no-op if already running), then focus existing tabs if present.
  // Only open new tabs when missing (prevents window/tab flicker).
  const started = runOpenclaw(['browser', '--browser-profile', 'openclaw', 'start', '--json'])

  const tabsRaw = runOpenclaw(['browser', '--browser-profile', 'openclaw', 'tabs', '--json'])
  const tabsJson = safeJsonParse<any>(tabsRaw) || {}
  const tabs: any[] = tabsJson.tabs || []

  function findTab(pred: (t: any) => boolean) {
    return tabs.find(pred)
  }

  const gw = findTab((t) => String(t?.url || '').startsWith('http://127.0.0.1:18789/'))
  const nd = findTab((t) => String(t?.url || '').includes('vault.netvoyage.com/neWeb2'))

  let gateway: any
  let netdocs: any

  if (gw?.targetId) {
    gateway = runOpenclaw(['browser', '--browser-profile', 'openclaw', 'focus', String(gw.targetId), '--json'])
  } else {
    gateway = runOpenclaw(['browser', '--browser-profile', 'openclaw', 'open', 'http://127.0.0.1:18789/', '--json'])
  }

  if (nd?.targetId) {
    netdocs = runOpenclaw(['browser', '--browser-profile', 'openclaw', 'focus', String(nd.targetId), '--json'])
  } else {
    netdocs = runOpenclaw(['browser', '--browser-profile', 'openclaw', 'open', 'https://vault.netvoyage.com/neWeb2/', '--json'])
  }

  return { ok: true, started, gateway, netdocs }
}

export async function POST(_req: Request) {
  try {
    const { workspacePath } = getNetdocsPaths()
    const results: any = {}

    results.runner = ensureRunner(workspacePath)
    results.browser = ensureBrowserAndTabs()
    results.downloader = ensureDownloader(workspacePath)

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to start mission')
  }
}
