import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-error'
import { execFileSync } from 'child_process'
import { existsSync } from 'fs'

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function getOpenclawBin(): string {
  // In some Next/server contexts, PATH doesn’t include the npm global bin dir.
  // Prefer explicit known locations.
  const candidates = [
    process.env.OPENCLAW_CLI_PATH,
    'C:\\Users\\SJK\\AppData\\Roaming\\npm\\openclaw.cmd',
    'C:\\Users\\SJK\\AppData\\Roaming\\npm\\openclaw',
    'openclaw',
  ].filter(Boolean) as string[]

  for (const c of candidates) {
    try {
      if (c === 'openclaw') return c
      if (existsSync(c)) return c
    } catch {}
  }
  return 'openclaw'
}

function runOpenclaw(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const bin = getOpenclawBin()
  const isCmd = bin.toLowerCase().endsWith('.cmd')
  const exe = isCmd ? 'cmd.exe' : bin
  const finalArgs = isCmd ? ['/c', bin, ...args] : args

  try {
    const stdout = execFileSync(exe, finalArgs, {
      encoding: 'utf-8',
      windowsHide: true,
    })
    return { ok: true, stdout: stdout ?? '', stderr: '' }
  } catch (err: any) {
    const stdout = (err?.stdout ? String(err.stdout) : '') as string
    const stderr = (err?.stderr ? String(err.stderr) : err?.message ? String(err.message) : '') as string
    return { ok: false, stdout, stderr }
  }
}

function isAllowedUrl(url: string) {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    if (host === '127.0.0.1' || host === 'localhost') return true
    if (host === 'vault.netvoyage.com') return true
    return false
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const action = (url.searchParams.get('action') || 'status').toLowerCase()

    if (action === 'status') {
      const r = runOpenclaw(['browser', '--browser-profile', 'openclaw', 'status', '--json'])
      return NextResponse.json({ ok: r.ok, action, stdout: r.stdout, stderr: r.stderr })
    }

    if (action === 'tabs') {
      const r = runOpenclaw(['browser', '--browser-profile', 'openclaw', 'tabs', '--json'])
      return NextResponse.json({ ok: r.ok, action, stdout: r.stdout, stderr: r.stderr })
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    return apiErrorResponse(err, 'OpenClaw browser API failed')
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || '').toLowerCase()

    if (!action) return NextResponse.json({ ok: false, error: 'Missing action' }, { status: 400 })

    if (action === 'start') {
      const r = runOpenclaw(['browser', '--browser-profile', 'openclaw', 'start', '--json'])
      return NextResponse.json({ ok: r.ok, action, stdout: r.stdout, stderr: r.stderr })
    }

    if (action === 'stop') {
      const r = runOpenclaw(['browser', '--browser-profile', 'openclaw', 'stop', '--json'])
      return NextResponse.json({ ok: r.ok, action, stdout: r.stdout, stderr: r.stderr })
    }

    if (action === 'focus') {
      const targetId = String(body?.targetId || '')
      if (!targetId) return NextResponse.json({ ok: false, error: 'Missing targetId' }, { status: 400 })
      const r = runOpenclaw(['browser', '--browser-profile', 'openclaw', 'focus', targetId, '--json'])
      return NextResponse.json({ ok: r.ok, action, targetId, stdout: r.stdout, stderr: r.stderr })
    }

    if (action === 'open') {
      const targetUrl = String(body?.url || '')
      if (!targetUrl) return NextResponse.json({ ok: false, error: 'Missing url' }, { status: 400 })
      if (!isAllowedUrl(targetUrl)) return NextResponse.json({ ok: false, error: 'URL not allowed' }, { status: 400 })
      const r = runOpenclaw(['browser', '--browser-profile', 'openclaw', 'open', targetUrl, '--json'])
      return NextResponse.json({ ok: r.ok, action, url: targetUrl, stdout: r.stdout, stderr: r.stderr })
    }

    if (action === 'ensure_mission_tabs') {
      // Start browser (no-op if already running), then ensure the key tabs exist.
      const started = runOpenclaw(['browser', '--browser-profile', 'openclaw', 'start', '--json'])

      const tabsRaw = runOpenclaw(['browser', '--browser-profile', 'openclaw', 'tabs', '--json'])
      const tabs = tabsRaw.ok ? safeJsonParse<any>(tabsRaw.stdout) : null
      const list: any[] = tabs?.tabs || []

      const want = [
        { name: 'gateway', url: 'http://127.0.0.1:18789/' },
        { name: 'netdocs', url: 'https://vault.netvoyage.com/neWeb2/' },
      ]

      const results: any = { started, ensured: {} as any, focused: [] as string[] }

      for (const w of want) {
        const existing = list.find((t) => String(t?.url || '').startsWith(w.url) || String(t?.title || '').includes('OpenClaw Control'))
        if (existing?.targetId) {
          const f = runOpenclaw(['browser', '--browser-profile', 'openclaw', 'focus', String(existing.targetId), '--json'])
          results.ensured[w.name] = { action: 'focus', targetId: existing.targetId, focus: f }
          results.focused.push(String(existing.targetId))
        } else {
          const o = runOpenclaw(['browser', '--browser-profile', 'openclaw', 'open', w.url, '--json'])
          results.ensured[w.name] = { action: 'open', open: o }
        }
      }

      return NextResponse.json({ ok: true, action, results })
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    return apiErrorResponse(err, 'OpenClaw browser API failed')
  }
}
