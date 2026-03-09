import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-error'
import { getNetdocsPaths, tailFile } from '@/lib/netdocs'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const lines = Math.min(500, Math.max(1, Number(url.searchParams.get('lines') ?? '100')))
    const { skipPath } = getNetdocsPaths()
    const tail = tailFile(skipPath, lines)
    return NextResponse.json({ path: skipPath, lines, tail })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load NetDocs skip log')
  }
}
