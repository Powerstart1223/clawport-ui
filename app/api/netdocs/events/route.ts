import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-error'
import { getNetdocsPaths, tailFile } from '@/lib/netdocs'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const lines = Math.max(1, Math.min(2000, Number(url.searchParams.get('lines') ?? '200')))

    const { eventsPath } = getNetdocsPaths()
    const tail = tailFile(eventsPath, lines)

    return NextResponse.json({ ok: true, path: eventsPath, tail, lines })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to read NetDocs events')
  }
}
