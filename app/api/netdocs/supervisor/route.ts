import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-error'
import { getNetdocsPaths } from '@/lib/netdocs'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'

function pidPath(workspacePath: string) {
  return join(workspacePath, 'netdocs_supervisor.pid')
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
    return apiErrorResponse(err, 'Failed to read supervisor status')
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || '').toLowerCase()

    const { workspacePath } = getNetdocsPaths()
    const p = pidPath(workspacePath)
    const script = join(workspacePath, 'netdocs_supervisor.py')

    if (action === 'start') {
      if (existsSync(p)) {
        const pid = Number(readFileSync(p, 'utf-8').trim())
        if (pid && isAlive(pid)) return NextResponse.json({ ok: true, running: true, pid })
      }

      const pyw = 'C:\\Users\\SJK\\AppData\\Local\\Programs\\Python\\Python313\\pythonw.exe'
      const py = 'python'
      const exe = existsSync(pyw) ? pyw : py
      const child = spawn(exe, [script], { cwd: workspacePath, detached: true, stdio: 'ignore', windowsHide: true })
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

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to start/stop supervisor')
  }
}
