import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-error'
import { getNetdocsPaths } from '@/lib/netdocs'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function pidPath(workspacePath: string) {
  return join(workspacePath, 'netdocs_runner.pid')
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export async function GET() {
  try {
    const { workspacePath } = getNetdocsPaths()
    const p = pidPath(workspacePath)
    if (!existsSync(p)) return NextResponse.json({ ok: true, running: false })
    const raw = readFileSync(p, 'utf-8').trim()
    const pid = Number(raw)
    if (!pid || Number.isNaN(pid)) return NextResponse.json({ ok: true, running: false })
    const running = isAlive(pid)
    return NextResponse.json({ ok: true, running, pid })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to read runner status')
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || '').toLowerCase()

    const { workspacePath } = getNetdocsPaths()
    const p = pidPath(workspacePath)
    const runnerScript = join(workspacePath, 'netdocs_runner.py')

    if (action === 'start') {
      if (existsSync(p)) {
        const pid = Number(readFileSync(p, 'utf-8').trim())
        if (pid && isAlive(pid)) return NextResponse.json({ ok: true, running: true, pid })
      }

      // Use python in PATH. If that fails, we'll return stderr via exception.
      const child = spawn('python', [runnerScript, '--loop'], {
        cwd: workspacePath,
        detached: true,
        stdio: 'ignore',
      })
      child.unref()
      writeFileSync(p, String(child.pid), { encoding: 'utf-8' })
      return NextResponse.json({ ok: true, running: true, pid: child.pid })
    }

    if (action === 'stop') {
      if (!existsSync(p)) return NextResponse.json({ ok: true, running: false })
      const pid = Number(readFileSync(p, 'utf-8').trim())
      if (pid && isAlive(pid)) {
        try {
          process.kill(pid)
        } catch {}
      }
      try {
        unlinkSync(p)
      } catch {}
      return NextResponse.json({ ok: true, running: false, pid })
    }

    if (action === 'poke') {
      // Run one tick (no loop) to consume a pending command quickly.
      const child = spawn('python', [runnerScript], { cwd: workspacePath, stdio: 'ignore', detached: true })
      child.unref()
      return NextResponse.json({ ok: true, launched: true, pid: child.pid })
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to start/stop runner')
  }
}
