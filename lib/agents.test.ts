// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockReadFileSync, mockExistsSync, bundledAgents } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockExistsSync: vi.fn(),
  bundledAgents: [
    {
      id: 'jarvis',
      name: 'Jarvis',
      title: 'Orchestrator',
      reportsTo: null,
      directReports: ['vera', 'lumen', 'pulse'],
      soulPath: 'SOUL.md',
      voiceId: 'agL69Vji082CshT65Tcy',
      color: '#f5c518',
      emoji: 'R',
      tools: ['exec', 'read', 'write'],
      memoryPath: null,
      description: 'Top-level orchestrator.',
    },
    {
      id: 'vera',
      name: 'VERA',
      title: 'Chief Strategy Officer',
      reportsTo: 'jarvis',
      directReports: ['robin'],
      soulPath: 'agents/vera/SOUL.md',
      voiceId: 'EAHourGM2PqzHHl0Ywjp',
      color: '#a855f7',
      emoji: 'P',
      tools: ['web_search', 'read'],
      memoryPath: null,
      description: 'CSO. Decides what gets built.',
    },
    {
      id: 'robin',
      name: 'Robin',
      title: 'Field Intel Operator',
      reportsTo: 'vera',
      directReports: [],
      soulPath: 'agents/robin/SOUL.md',
      voiceId: null,
      color: '#3b82f6',
      emoji: 'E',
      tools: ['web_search'],
      memoryPath: null,
      description: 'Field operator.',
    },
    {
      id: 'lumen',
      name: 'LUMEN',
      title: 'SEO Team Director',
      reportsTo: 'jarvis',
      directReports: ['scout'],
      soulPath: 'agents/seo-team/SOUL.md',
      voiceId: null,
      color: '#22c55e',
      emoji: 'L',
      tools: ['web_search', 'read'],
      memoryPath: null,
      description: 'SEO Team Director.',
    },
    {
      id: 'scout',
      name: 'SCOUT',
      title: 'Content Scout',
      reportsTo: 'lumen',
      directReports: [],
      soulPath: null,
      voiceId: null,
      color: '#86efac',
      emoji: 'S',
      tools: ['web_search'],
      memoryPath: null,
      description: 'Scouts trending topics.',
    },
    {
      id: 'pulse',
      name: 'Pulse',
      title: 'Trend Radar',
      reportsTo: 'jarvis',
      directReports: [],
      soulPath: 'agents/pulse/SOUL.md',
      voiceId: null,
      color: '#eab308',
      emoji: 'W',
      tools: ['web_search'],
      memoryPath: null,
      description: 'Hype radar.',
    },
    {
      id: 'kaze',
      name: 'KAZE',
      title: 'Japan Flight Monitor',
      reportsTo: 'jarvis',
      directReports: [],
      soulPath: null,
      voiceId: null,
      color: '#60a5fa',
      emoji: 'A',
      tools: ['web_fetch'],
      memoryPath: null,
      description: 'Monitors flights.',
    },
  ],
}))

// Mock fs (Dependency Inversion -- no real file system access in tests)
vi.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  existsSync: mockExistsSync,
  default: { readFileSync: mockReadFileSync, existsSync: mockExistsSync },
}))

// Mock the bundled agents.json
vi.mock('@/lib/agents.json', () => ({
  default: bundledAgents,
}))

// We need to import AFTER mocks are set up
import { getAgents, getAgent } from './agents'

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  // Default: no SOUL files exist on disk
  mockExistsSync.mockReturnValue(false)
})

// ---------------------------------------------------------------------------
// Registry loading: bundled fallback vs workspace override
// ---------------------------------------------------------------------------

describe('agent registry loading', () => {
  it('loads from bundled JSON when WORKSPACE_PATH is not set', async () => {
    vi.stubEnv('WORKSPACE_PATH', '')
    const agents = await getAgents()
    expect(agents.length).toBe(bundledAgents.length)
    expect(agents.map(a => a.id)).toContain('jarvis')
  })

  it('loads from bundled JSON when workspace override file does not exist', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/test-workspace')
    mockExistsSync.mockReturnValue(false)
    const agents = await getAgents()
    expect(agents.length).toBe(bundledAgents.length)
  })

  it('loads from workspace override when manor/agents.json exists', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/test-workspace')

    const customAgents = [
      {
        id: 'custom-bot',
        name: 'CustomBot',
        title: 'Custom Agent',
        reportsTo: null,
        directReports: [],
        soulPath: null,
        voiceId: null,
        color: '#ff0000',
        emoji: 'C',
        tools: ['read'],
        memoryPath: null,
        description: 'A custom agent.',
      },
    ]

    mockExistsSync.mockImplementation((path: string) => {
      if (path === '/tmp/test-workspace/manor/agents.json') return true
      return false
    })
    mockReadFileSync.mockImplementation((path: string) => {
      if (path === '/tmp/test-workspace/manor/agents.json') {
        return JSON.stringify(customAgents)
      }
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    expect(agents.length).toBe(1)
    expect(agents[0].id).toBe('custom-bot')
    expect(agents[0].name).toBe('CustomBot')
  })

  it('falls back to bundled JSON when workspace agents.json is malformed', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/test-workspace')

    mockExistsSync.mockImplementation((path: string) => {
      if (path === '/tmp/test-workspace/manor/agents.json') return true
      return false
    })
    mockReadFileSync.mockImplementation((path: string) => {
      if (path === '/tmp/test-workspace/manor/agents.json') {
        return '{ invalid json !!!'
      }
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    // Should fall back to bundled agents, not crash
    expect(agents.length).toBe(bundledAgents.length)
    expect(agents.map(a => a.id)).toContain('jarvis')
  })

  it('falls back to bundled JSON when workspace agents.json read throws', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/test-workspace')

    mockExistsSync.mockImplementation((path: string) => {
      if (path === '/tmp/test-workspace/manor/agents.json') return true
      return false
    })
    mockReadFileSync.mockImplementation((path: string) => {
      if (path === '/tmp/test-workspace/manor/agents.json') {
        throw new Error('EACCES')
      }
      throw new Error('ENOENT')
    })

    const agents = await getAgents()
    expect(agents.length).toBe(bundledAgents.length)
  })
})

// ---------------------------------------------------------------------------
// getAgents
// ---------------------------------------------------------------------------

describe('getAgents', () => {
  it('returns all agents from the registry', async () => {
    const agents = await getAgents()
    expect(agents.length).toBeGreaterThan(0)
  })

  it('every agent has required fields', async () => {
    const agents = await getAgents()
    for (const agent of agents) {
      expect(agent.id).toEqual(expect.any(String))
      expect(agent.name).toEqual(expect.any(String))
      expect(agent.title).toEqual(expect.any(String))
      expect(agent.color).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(agent.emoji).toEqual(expect.any(String))
      expect(Array.isArray(agent.tools)).toBe(true)
      expect(Array.isArray(agent.directReports)).toBe(true)
      expect(Array.isArray(agent.crons)).toBe(true)
      expect(agent.description).toEqual(expect.any(String))
    }
  })

  it('includes known agents by id', async () => {
    const agents = await getAgents()
    const ids = agents.map(a => a.id)
    expect(ids).toContain('jarvis')
    expect(ids).toContain('vera')
    expect(ids).toContain('lumen')
    expect(ids).toContain('pulse')
    expect(ids).toContain('kaze')
  })

  it('sets soul to null when WORKSPACE_PATH is not set', async () => {
    vi.stubEnv('WORKSPACE_PATH', '')
    const agents = await getAgents()
    const jarvis = agents.find(a => a.id === 'jarvis')!
    expect(jarvis.soulPath).toBeTruthy()
    expect(jarvis.soul).toBeNull()
  })

  it('sets soul to null when soulPath file does not exist', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    mockExistsSync.mockReturnValue(false)
    const agents = await getAgents()
    const jarvis = agents.find(a => a.id === 'jarvis')!
    expect(jarvis.soulPath).toBeTruthy()
    expect(jarvis.soul).toBeNull()
  })

  it('reads soul content when soulPath file exists', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    mockExistsSync.mockImplementation((path: string) => {
      // Only the SOUL file exists, not the workspace override
      if (path === '/tmp/ws/manor/agents.json') return false
      return true
    })
    mockReadFileSync.mockReturnValue('# Jarvis SOUL')
    const agents = await getAgents()
    const jarvis = agents.find(a => a.id === 'jarvis')!
    expect(jarvis.soul).toBe('# Jarvis SOUL')
  })

  it('sets soul to null when readFileSync throws', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    mockExistsSync.mockImplementation((path: string) => {
      if (path === '/tmp/ws/manor/agents.json') return false
      return true
    })
    mockReadFileSync.mockImplementation(() => { throw new Error('EACCES') })
    const agents = await getAgents()
    const jarvis = agents.find(a => a.id === 'jarvis')!
    expect(jarvis.soul).toBeNull()
  })

  it('initializes crons as empty array for every agent', async () => {
    const agents = await getAgents()
    for (const agent of agents) {
      expect(agent.crons).toEqual([])
    }
  })

  it('agents with no soulPath get soul=null without reading fs', async () => {
    vi.stubEnv('WORKSPACE_PATH', '/tmp/ws')
    mockExistsSync.mockReturnValue(false)
    const agents = await getAgents()
    const scout = agents.find(a => a.id === 'scout')!
    expect(scout.soulPath).toBeNull()
    expect(scout.soul).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getAgent
// ---------------------------------------------------------------------------

describe('getAgent', () => {
  it('returns the correct agent by id', async () => {
    const agent = await getAgent('vera')
    expect(agent).not.toBeNull()
    expect(agent!.id).toBe('vera')
    expect(agent!.name).toBe('VERA')
    expect(agent!.title).toBe('Chief Strategy Officer')
  })

  it('returns null for an unknown id', async () => {
    const agent = await getAgent('nonexistent-agent')
    expect(agent).toBeNull()
  })

  it('returns null for empty string', async () => {
    const agent = await getAgent('')
    expect(agent).toBeNull()
  })

  it('is case-sensitive (uppercase id returns null)', async () => {
    const agent = await getAgent('VERA')
    expect(agent).toBeNull()
  })

  it('returns agent with correct directReports', async () => {
    const jarvis = await getAgent('jarvis')
    expect(jarvis).not.toBeNull()
    expect(jarvis!.directReports).toContain('vera')
    expect(jarvis!.directReports).toContain('lumen')
    expect(jarvis!.directReports).toContain('pulse')
  })

  it('returns agent with correct reportsTo chain', async () => {
    const robin = await getAgent('robin')
    expect(robin).not.toBeNull()
    expect(robin!.reportsTo).toBe('vera')

    const vera = await getAgent('vera')
    expect(vera!.reportsTo).toBe('jarvis')

    const jarvis = await getAgent('jarvis')
    expect(jarvis!.reportsTo).toBeNull()
  })
})
