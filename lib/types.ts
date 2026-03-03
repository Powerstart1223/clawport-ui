// Shared types for the Manor UI

export interface Agent {
  id: string               // slug, e.g. "vera"
  name: string             // display name, e.g. "VERA"
  title: string            // role title, e.g. "Chief Strategy Officer"
  reportsTo: string | null // parent agent id (null for root orchestrator)
  directReports: string[]  // child agent ids
  soulPath: string | null  // absolute path to SOUL.md
  soul: string | null      // full SOUL.md content
  voiceId: string | null   // ElevenLabs voice ID
  color: string            // hex color for node
  emoji: string            // emoji identifier
  tools: string[]          // list of tools this agent has access to
  crons: CronJob[]         // associated cron jobs
  memoryPath: string | null
  description: string      // one-liner description
}

export interface CronDelivery {
  mode: string
  channel: string
  to: string | null
}

export interface CronRun {
  ts: number
  jobId: string
  status: 'ok' | 'error'
  summary: string | null
  error: string | null
  durationMs: number
  deliveryStatus: string | null
}

export interface CronJob {
  id: string
  name: string
  schedule: string              // raw cron expression
  scheduleDescription: string   // human-readable (e.g., "Daily at 8 AM")
  timezone: string | null       // extracted from schedule object if present
  status: 'ok' | 'error' | 'idle'
  lastRun: string | null
  nextRun: string | null
  lastError: string | null
  agentId: string | null        // which agent this belongs to (matched by name)
  description: string | null
  enabled: boolean
  delivery: CronDelivery | null
  lastDurationMs: number | null
  consecutiveErrors: number
  lastDeliveryStatus: string | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface MemoryFile {
  label: string
  path: string
  content: string
  lastModified: string
}
