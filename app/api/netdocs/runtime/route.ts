import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-error'
import { getNetdocsPaths } from '@/lib/netdocs'
import { existsSync, readFileSync } from 'fs'

type RuntimeStatus = {
  ts?: string
  state?: 'running' | 'paused' | 'stopped'
  client?: string | null
  path?: string | null
  view?: string | null
  row?: number | null
  title?: string | null
  note?: string | null
  lastError?: { ts?: string; error?: string; note?: string } | null
}

export async function GET() {
  try {
    const { statusPath } = getNetdocsPaths() as any
    if (!statusPath || !existsSync(statusPath)) {
      return NextResponse.json({ found: false, status: null })
    }
    const raw = readFileSync(statusPath, 'utf-8')
    let status: RuntimeStatus | null = null
    try {
      status = JSON.parse(raw) as RuntimeStatus
    } catch {
      status = null
    }
    return NextResponse.json({ found: true, status, raw })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to read NetDocs runtime status')
  }
}
