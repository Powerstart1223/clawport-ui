import { CronJob, CronDelivery } from '@/lib/types'
import { execSync } from 'child_process'
import { parseSchedule, describeCron } from './cron-utils'
import { requireEnv } from '@/lib/env'

const PREFIX_MAP: [string, string][] = [
  ['pulse-', 'pulse'],
  ['herald-', 'herald'],
  ['robin-', 'robin'],
  ['seo-team-', 'lumen'],
  ['seo-', 'lumen'],
  ['echo-', 'echo'],
  ['spark-', 'spark'],
  ['scribe-', 'scribe'],
  ['kaze-', 'kaze'],
  ['vault-', 'jarvis'],
  ['builder-', 'jarvis'],
  ['manor-', 'jarvis'],
  ['maven-', 'maven'],
  ['recon-', 'robin'],
  ['team-memory-', 'scribe'],
  ['mochi-', 'pulse'],
]

function matchAgent(name: string): string | null {
  for (const [prefix, agentId] of PREFIX_MAP) {
    if (name.startsWith(prefix)) return agentId
  }
  return null
}

export async function getCrons(): Promise<CronJob[]> {
  try {
    const openclawBin = requireEnv('OPENCLAW_BIN')
    const raw = execSync(`${openclawBin} cron list --json`, {
      encoding: 'utf-8',
      timeout: 10000,
    })

    const parsed = JSON.parse(raw)
    const jobs: unknown[] = Array.isArray(parsed)
      ? parsed
      : parsed.jobs ?? parsed.data ?? []

    return jobs.map((job: unknown) => {
      const j = job as Record<string, unknown>
      const state = (j.state as Record<string, unknown>) || {}
      const name = String(j.name || '')
      const { expression: schedule, timezone } = parseSchedule(j.schedule)

      // Status can be in state.status or directly on j.status
      const rawStatus = state.status ?? j.status ?? ''
      let status: 'ok' | 'error' | 'idle' = 'idle'
      if (rawStatus === 'error' || rawStatus === 'failed') {
        status = 'error'
      } else if (rawStatus === 'ok' || rawStatus === 'success' || rawStatus === 'completed') {
        status = 'ok'
      }

      // nextRun: try state.nextRunAtMs first, then state.nextRunAt
      const nextRunMs = state.nextRunAtMs ?? state.nextRunAt ?? j.nextRunAtMs ?? j.nextRunAt
      const nextRun = nextRunMs
        ? new Date(Number(nextRunMs)).toISOString()
        : null

      // lastRun: try state.lastRunAtMs, state.lastRunAt, or top-level equivalents
      const lastRunRaw = state.lastRunAtMs ?? state.lastRunAt ?? j.lastRunAtMs ?? j.lastRunAt ?? j.last
      const lastRun = lastRunRaw
        ? (typeof lastRunRaw === 'number' ? new Date(lastRunRaw).toISOString() : String(lastRunRaw))
        : null

      const lastError = (state.lastError ?? state.error ?? j.lastError) ? String(state.lastError ?? state.error ?? j.lastError) : null

      // Delivery config
      const rawDelivery = j.delivery as Record<string, unknown> | undefined
      let delivery: CronDelivery | null = null
      if (rawDelivery && typeof rawDelivery === 'object') {
        delivery = {
          mode: String(rawDelivery.mode || ''),
          channel: String(rawDelivery.channel || ''),
          to: rawDelivery.to ? String(rawDelivery.to) : null,
        }
      }

      // Rich state fields
      const lastDurationMs = typeof state.lastDurationMs === 'number' ? state.lastDurationMs : null
      const consecutiveErrors = typeof state.consecutiveErrors === 'number' ? state.consecutiveErrors : 0
      const lastDeliveryStatus = typeof state.lastDeliveryStatus === 'string' ? state.lastDeliveryStatus : null

      return {
        id: String(j.id || j.name || ''),
        name,
        schedule,
        scheduleDescription: describeCron(schedule),
        timezone,
        status,
        lastRun,
        nextRun,
        lastError,
        agentId: matchAgent(name),
        description: typeof j.description === 'string' ? j.description : null,
        enabled: j.enabled !== false,
        delivery,
        lastDurationMs,
        consecutiveErrors,
        lastDeliveryStatus,
      }
    })
  } catch (err) {
    throw new Error(
      `Failed to fetch cron jobs: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
