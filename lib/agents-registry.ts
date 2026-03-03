import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import bundledRegistry from '@/lib/agents.json'
import type { Agent } from '@/lib/types'

/** Raw agent data from JSON (everything except runtime-loaded soul and crons) */
export type AgentEntry = Omit<Agent, 'soul' | 'crons'>

/**
 * Load the agent registry, checking for a user-provided override first.
 *
 * Resolution order:
 *   1. $WORKSPACE_PATH/manor/agents.json  (user's own config)
 *   2. Bundled lib/agents.json             (default example registry)
 *
 * This lets any OpenClaw user customise their agent team without editing
 * Manor UI source code -- just drop an agents.json into their workspace.
 */
export function loadRegistry(): AgentEntry[] {
  const workspacePath = process.env.WORKSPACE_PATH

  if (workspacePath) {
    const userRegistryPath = join(workspacePath, 'manor', 'agents.json')
    if (existsSync(userRegistryPath)) {
      try {
        const raw = readFileSync(userRegistryPath, 'utf-8')
        return JSON.parse(raw) as AgentEntry[]
      } catch {
        // Malformed user JSON -- fall through to bundled default
      }
    }
  }

  return bundledRegistry as AgentEntry[]
}
