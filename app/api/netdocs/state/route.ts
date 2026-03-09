import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-error'
import { readNetdocsState, getNetdocsPaths } from '@/lib/netdocs'

export async function GET() {
  try {
    const { state, found, raw } = readNetdocsState()
    const paths = getNetdocsPaths()
    return NextResponse.json({ found, state, raw: raw ?? null, paths })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load NetDocs state')
  }
}
