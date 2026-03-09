import { getNetdocsPaths } from '@/lib/netdocs'
import { existsSync, readFileSync, statSync } from 'fs'

export const runtime = 'nodejs'

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function GET() {
  const { eventsPath } = getNetdocsPaths()

  const encoder = new TextEncoder()

  let offset = 0
  try {
    if (existsSync(eventsPath)) {
      // Start from the end but include a small tail so the UI isn't blank.
      const size = statSync(eventsPath).size
      offset = Math.max(0, size - 64 * 1024)
    }
  } catch {
    offset = 0
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Initial hello
      controller.enqueue(encoder.encode(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`))

      // Immediately ship a tail (from offset) so the UI shows something on first connect.
      try {
        if (existsSync(eventsPath)) {
          const raw = readFileSync(eventsPath)
          const chunk = raw.subarray(offset)
          offset = raw.length
          const text = chunk.toString('utf-8')
          const lines = text.split(/\r?\n/).filter(Boolean)
          for (const line of lines) {
            controller.enqueue(encoder.encode(`event: line\ndata: ${JSON.stringify({ line })}\n\n`))
          }
        }
      } catch (e: any) {
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(e?.message || e) })}\n\n`)
        )
      }

      while (true) {
        try {
          if (!existsSync(eventsPath)) {
            await sleep(750)
            continue
          }

          const st = statSync(eventsPath)
          if (st.size < offset) {
            // log rotated/truncated
            offset = 0
          }

          if (st.size > offset) {
            const raw = readFileSync(eventsPath)
            const chunk = raw.subarray(offset)
            offset = st.size

            const text = chunk.toString('utf-8')
            const lines = text.split(/\r?\n/).filter(Boolean)
            for (const line of lines) {
              controller.enqueue(encoder.encode(`event: line\ndata: ${JSON.stringify({ line })}\n\n`))
            }
          }
        } catch (e: any) {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(e?.message || e) })}\n\n`)
          )
        }

        // Heartbeat so proxies don’t close the connection
        controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`))
        await sleep(750)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
