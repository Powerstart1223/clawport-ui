import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-error'
import { listRecentFiles, readNetdocsState } from '@/lib/netdocs'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? '20')))
    const { state } = readNetdocsState()
    const dest = state?.paths?.dest ?? 'E:\\etdocumentsdownload'
    const files = listRecentFiles(dest, limit)
    return NextResponse.json({ dest, limit, files })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to list destination files')
  }
}
