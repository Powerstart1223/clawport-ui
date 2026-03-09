'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type NetdocsState = {
  updatedAt?: string
  runStartedAt?: string
  currentClient?: string | null
  currentFolder?: string | null
  currentPath?: string | null
  lastTitle?: string | null
  counts?: { downloaded?: number; skippedOver50mb?: number; errors?: number }
  paths?: { dest?: string; skipLog?: string }
}

function usePoll<T>(url: string, intervalMs: number, init: T) {
  const [data, setData] = useState<T>(init)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function tick() {
      try {
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as T
        if (!cancelled) {
          setData(json)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      }
    }

    tick()
    const id = setInterval(tick, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [url, intervalMs])

  return { data, error }
}

export default function NetdocsPage() {
  // Faster polling for a "more reactive" dashboard.
  const runtimeResp = usePoll<any>('/api/netdocs/runtime', 750, { found: false, status: null })
  const stateResp = usePoll<any>('/api/netdocs/state', 1000, { found: false, state: null })
  // Events are streamed via SSE (much more "live" than polling)
  const eventsResp = usePoll<any>('/api/netdocs/events?lines=50', 5000, { tail: [] })
  const seenResp = usePoll<any>('/api/netdocs/seen?lines=25', 2500, { tail: [] })
  const skipResp = usePoll<any>('/api/netdocs/skips?lines=25', 6000, { tail: [] })
  const outResp = usePoll<any>('/api/netdocs/output?limit=15', 6000, { files: [], dest: '' })

  const [liveEvents, setLiveEvents] = useState<string[]>([])

  // OpenClaw Browser Control (real start/stop + open tabs)
  const ocStatusResp = usePoll<any>('/api/openclaw/browser?action=status', 1250, { ok: false, stdout: '', stderr: '' })

  // NetDocs runner (consumer loop) status
  const runnerResp = usePoll<any>('/api/netdocs/runner', 1000, { running: false })
  // NetDocs downloader (does the actual download loop)
  const dlResp = usePoll<any>('/api/netdocs/downloader', 1000, { running: false })

  const st: NetdocsState | null = stateResp.data?.state ?? null

  useEffect(() => {
    // Seed live events with a small tail so the box isn't empty on load.
    const seeded = (eventsResp.data?.tail ?? []) as string[]
    if (seeded.length && liveEvents.length === 0) setLiveEvents(seeded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsResp.data?.tail])

  useEffect(() => {
    const es = new EventSource('/api/netdocs/events-stream')

    function onLine(ev: MessageEvent) {
      try {
        const obj = JSON.parse(ev.data)
        const line = String(obj?.line ?? '')
        if (!line) return
        setLiveEvents((prev) => {
          const next = [...prev, line]
          return next.slice(-300)
        })
      } catch {
        // ignore
      }
    }

    es.addEventListener('line', onLine as any)

    es.onerror = () => {
      // browser will retry automatically
    }

    return () => {
      es.removeEventListener('line', onLine as any)
      es.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const status = useMemo(() => {
    if (!stateResp.data?.found) return 'not-configured'
    if (!st) return 'bad-state'
    return 'ready'
  }, [stateResp.data, st])

  const [controlBusy, setControlBusy] = useState(false)
  const [controlMsg, setControlMsg] = useState<string | null>(null)

  // Show the last command we wrote so it’s obvious buttons did *something*.
  const controlResp = usePoll<any>('/api/netdocs/control', 750, { found: false, control: null })

  async function sendControl(cmd: string, extra: Record<string, unknown> = {}) {
    setControlBusy(true)
    setControlMsg(`sent: ${cmd}`)
    try {
      const res = await fetch('/api/netdocs/control', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cmd, ...extra }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`)
      setControlMsg(`ok: ${cmd}`)
      // quick release so buttons feel responsive but we avoid accidental double-taps
      setTimeout(() => setControlBusy(false), 350)
    } catch (e) {
      setControlBusy(false)
      setControlMsg(`error: ${(e as Error).message}`)
    }
  }

  async function openclaw(action: 'start' | 'stop' | 'open' | 'ensure_mission_tabs', url?: string) {
    setControlBusy(true)
    setControlMsg(`openclaw: ${action}`)
    try {
      const res = await fetch('/api/openclaw/browser', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(action === 'open' ? { action, url } : { action }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.ok === false) throw new Error(json?.error || json?.stderr || `HTTP ${res.status}`)
      setControlMsg(`ok: openclaw ${action}`)
      setTimeout(() => setControlBusy(false), 350)
    } catch (e) {
      setControlBusy(false)
      setControlMsg(`error: ${(e as Error).message}`)
    }
  }

  async function runner(action: 'start' | 'stop' | 'poke') {
    setControlBusy(true)
    setControlMsg(`runner: ${action}`)
    try {
      const res = await fetch('/api/netdocs/runner', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`)
      setControlMsg(`ok: runner ${action}`)
      setTimeout(() => setControlBusy(false), 350)
    } catch (e) {
      setControlBusy(false)
      setControlMsg(`error: ${(e as Error).message}`)
    }
  }

  async function downloader(action: 'start' | 'stop' | 'poke') {
    setControlBusy(true)
    setControlMsg(`downloader: ${action}`)
    try {
      const res = await fetch('/api/netdocs/downloader', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`)
      setControlMsg(`ok: downloader ${action}`)
      setTimeout(() => setControlBusy(false), 350)
    } catch (e) {
      setControlBusy(false)
      setControlMsg(`error: ${(e as Error).message}`)
    }
  }

  async function startMission() {
    // One button: ensure browser + tabs, start runner, start downloader, resume.
    await runner('start')
    await openclaw('ensure_mission_tabs')
    await downloader('start')
    await sendControl('resume')
  }

  return (
    <div className="h-screen p-6 flex flex-col gap-6 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">NetDocs Mission Control</h1>
          <div className="text-sm opacity-70">Local dashboard for NetDocuments automation state + controls</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{status}</Badge>
          {runtimeResp.data?.status?.state && (
            <Badge variant={runtimeResp.data.status.state === 'running' ? 'default' : 'secondary'}>
              {runtimeResp.data.status.state}
            </Badge>
          )}
          {controlResp.data?.control?.cmd && (
            <Badge variant="secondary">
              last cmd: {String(controlResp.data.control.cmd)}#{String(controlResp.data.control.commandId ?? '—')}
            </Badge>
          )}
          {controlMsg && <Badge variant={controlMsg.startsWith('error:') ? 'destructive' : 'secondary'}>{controlMsg}</Badge>}
          {stateResp.error && <Badge variant="destructive">state: {stateResp.error}</Badge>}
          {runtimeResp.error && <Badge variant="destructive">runtime: {runtimeResp.error}</Badge>}
          {controlResp.error && <Badge variant="destructive">control: {controlResp.error}</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-none min-h-0">
        <Card className="p-4 space-y-2">
          <div className="text-sm font-medium">Current</div>
          <div className="text-sm">Client: <span className="font-mono">{runtimeResp.data?.status?.client ?? st?.currentClient ?? '—'}</span></div>
          <div className="text-sm">Folder: <span className="font-mono">{st?.currentFolder ?? '—'}</span></div>
          <div className="text-sm">Path: <span className="font-mono">{runtimeResp.data?.status?.path ?? st?.currentPath ?? '—'}</span></div>
          <div className="text-sm">Row: <span className="font-mono">{runtimeResp.data?.status?.row ?? '—'}</span></div>
          <div className="text-sm">Title: <span className="font-mono">{runtimeResp.data?.status?.title ?? st?.lastTitle ?? '—'}</span></div>
          <div className="text-xs opacity-70">Updated: {st?.updatedAt ?? runtimeResp.data?.status?.ts ?? '—'}</div>
          {runtimeResp.data?.status?.note && <div className="text-xs opacity-70">Note: {runtimeResp.data.status.note}</div>}
          {runtimeResp.data?.status?.lastError?.error && (
            <div className="text-xs text-red-600">
              Last error: {runtimeResp.data.status.lastError.error}
              {runtimeResp.data.status.lastError.note ? ` — ${runtimeResp.data.status.lastError.note}` : ''}
            </div>
          )}
        </Card>

        <Card className="p-4 space-y-2">
          <div className="text-sm font-medium">Counts</div>
          <div className="text-sm">Downloaded: <span className="font-mono">{st?.counts?.downloaded ?? 0}</span></div>
          <div className="text-sm">Skipped &gt;50MB: <span className="font-mono">{st?.counts?.skippedOver50mb ?? 0}</span></div>
          <div className="text-sm">Errors: <span className="font-mono">{st?.counts?.errors ?? 0}</span></div>
          <div className="text-sm">Dest: <span className="font-mono break-all">{st?.paths?.dest ?? outResp.data?.dest ?? 'E:\\etdocumentsdownload'}</span></div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="text-sm font-medium">Mission Control</div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={runnerResp.data?.running ? 'default' : 'destructive'}>
              runner: {runnerResp.data?.running ? `running (pid ${runnerResp.data?.pid ?? '—'})` : 'stopped'}
            </Badge>
            <Badge variant={dlResp.data?.running ? 'default' : 'destructive'}>
              downloader: {dlResp.data?.running ? `running (pid ${dlResp.data?.pid ?? '—'})` : 'stopped'}
            </Badge>
            <Badge variant={String(ocStatusResp.data?.stdout || '').includes('"running": true') || String(ocStatusResp.data?.stdout || '').includes('"running":true') ? 'default' : 'destructive'}>
              browser: {String(ocStatusResp.data?.stdout || '').includes('"running": true') || String(ocStatusResp.data?.stdout || '').includes('"running":true') ? 'running' : 'stopped'}
            </Badge>
            {runtimeResp.data?.status?.state && (
              <Badge variant={runtimeResp.data.status.state === 'running' ? 'default' : 'secondary'}>
                mission: {runtimeResp.data.status.state}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button disabled={controlBusy} onClick={startMission}>Start Mission</Button>
            <Button
              disabled={controlBusy}
              variant="secondary"
              onClick={async () => {
                await sendControl('pause')
                await downloader('stop')
              }}
            >
              Stop
            </Button>
          </div>

          <div className="text-xs opacity-70">
            When running correctly, Start Mission will launch the OpenClaw browser, open the Gateway dashboard, then open NetDocuments.
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
        <Card className="p-4 flex flex-col min-h-0">
          <div className="text-sm font-medium mb-2">Live events</div>
          <div className="text-xs opacity-70 mb-2">Streaming from netdocs_events.jsonl (auto-updates)</div>
          <pre className="text-xs whitespace-pre-wrap break-words flex-1 min-h-0 overflow-auto">
            {liveEvents.join('\n')}
          </pre>
        </Card>

        <Card className="p-4 flex flex-col min-h-0">
          <div className="text-sm font-medium mb-2">Last screen (selected row proof)</div>
          <div className="text-xs opacity-70 mb-2">Auto-refreshes; file: netdocs_last.png</div>
          <div className="flex-1 min-h-0 overflow-auto">
            <img
              src={`/api/netdocs/lastshot?ts=${encodeURIComponent(st?.updatedAt ?? Date.now().toString())}`}
              alt="Last NetDocs screenshot"
              className="w-full border rounded"
              onError={(e) => {
                // Hide broken image icon when file doesn't exist yet
                ;(e.currentTarget as HTMLImageElement).style.display = 'none'
              }}
              onLoad={(e) => {
                ;(e.currentTarget as HTMLImageElement).style.display = 'block'
              }}
            />
          </div>
          <div className="pt-4 flex flex-col min-h-0">
            <div className="text-sm font-medium mb-2">Recent downloads (seen log)</div>
            {seenResp.error && <div className="text-xs text-red-500">{seenResp.error}</div>}
            <pre className="text-xs whitespace-pre-wrap break-words flex-1 min-h-0 overflow-auto">
              {(seenResp.data?.tail ?? []).join('\n')}
            </pre>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-4 flex-none min-h-0">
        <Card className="p-4 flex flex-col min-h-0">
          <div className="text-sm font-medium mb-2">Skipped &gt;50MB</div>
          {skipResp.error && <div className="text-xs text-red-500">{skipResp.error}</div>}
          <pre className="text-xs whitespace-pre-wrap break-words flex-1 min-h-0 overflow-auto">
            {(skipResp.data?.tail ?? []).join('\n')}
          </pre>
        </Card>
      </div>

      <Card className="p-4">
        <div className="text-sm font-medium mb-2">Destination folder (recent files)</div>
        {outResp.error && <div className="text-xs text-red-500">{outResp.error}</div>}
        <div className="text-xs opacity-70 mb-2">{outResp.data?.dest}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(outResp.data?.files ?? []).map((f: any) => (
            <div key={f.path} className="flex justify-between border rounded px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm truncate">{f.name}</div>
                <div className="text-xs opacity-70 truncate">{f.lastModified}</div>
              </div>
              <div className="text-xs font-mono opacity-70 pl-2">{f.sizeBytes}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
