import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-error'
import { getNetdocsPaths } from '@/lib/netdocs'
import { existsSync, readFileSync, writeFileSync } from 'fs'

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const { controlPath } = getNetdocsPaths()
    if (!existsSync(controlPath)) return NextResponse.json({ ok: true, found: false, control: null })
    const raw = readFileSync(controlPath, 'utf-8')
    return NextResponse.json({ ok: true, found: true, control: safeJsonParse<any>(raw), raw })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to read NetDocs control file')
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const { controlPath, statusPath } = getNetdocsPaths()
    const ts = new Date().toISOString()

    // Give each command a monotonic-ish id so the UI can show "last command" clearly.
    const prev = existsSync(controlPath) ? safeJsonParse<any>(readFileSync(controlPath, 'utf-8')) : null
    const nextId = (prev?.commandId ? Number(prev.commandId) : 0) + 1

    const payload = {
      ...body,
      ts,
      commandId: nextId,
    }

    writeFileSync(controlPath, JSON.stringify(payload, null, 2), { encoding: 'utf-8' })

    // UX improvement: update status immediately so the dashboard reflects Start/Stop even
    // before the downloader loop consumes the control file.
    const cmd = String((payload as any).cmd ?? '')
    if (existsSync(statusPath) && (cmd === 'pause' || cmd === 'resume')) {
      const st = safeJsonParse<any>(readFileSync(statusPath, 'utf-8')) ?? {}
      st.ts = st.ts || ts
      st.note = st.note || ''
      if (cmd === 'pause') st.state = 'paused'
      if (cmd === 'resume') st.state = 'running'
      st.lastCommand = { cmd, commandId: nextId, ts }
      writeFileSync(statusPath, JSON.stringify(st, null, 2), { encoding: 'utf-8' })
    }

    return NextResponse.json({ ok: true, controlPath, statusPath, payload })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to write NetDocs control file')
  }
}
