import { apiErrorResponse } from '@/lib/api-error'
import { getNetdocsPaths } from '@/lib/netdocs'
import { existsSync, readFileSync } from 'fs'

export async function GET() {
  try {
    const { lastShotPath } = getNetdocsPaths()
    if (!existsSync(lastShotPath)) {
      return new Response('Not found', { status: 404 })
    }

    const buf = readFileSync(lastShotPath)
    return new Response(buf, {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'cache-control': 'no-store',
      },
    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to read NetDocs last screenshot')
  }
}
