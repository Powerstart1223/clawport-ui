import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadSettings, saveSettings, hexToAccentFill } from './settings'

// Mock localStorage
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key]
  }),
  clear: vi.fn(() => {
    Object.keys(store).forEach((k) => delete store[k])
  }),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
})

describe('loadSettings', () => {
  it('returns defaults when nothing is stored', () => {
    const s = loadSettings()
    expect(s).toEqual({
      accentColor: null,
      manorName: null,
      manorSubtitle: null,
      manorEmoji: null,
      manorIcon: null,
      iconBgHidden: false,
      emojiOnly: false,
      operatorName: null,
      agentOverrides: {},
    })
  })

  it('parses stored settings correctly', () => {
    store['manor-settings'] = JSON.stringify({
      accentColor: '#3B82F6',
      manorName: 'HQ',
      manorSubtitle: 'Base',
      manorEmoji: '🚀',
      manorIcon: 'data:image/jpeg;base64,icon123',
      agentOverrides: { jarvis: { emoji: '🎯' } },
    })
    const s = loadSettings()
    expect(s.accentColor).toBe('#3B82F6')
    expect(s.manorName).toBe('HQ')
    expect(s.manorSubtitle).toBe('Base')
    expect(s.manorEmoji).toBe('🚀')
    expect(s.manorIcon).toBe('data:image/jpeg;base64,icon123')
    expect(s.agentOverrides.jarvis).toEqual({ emoji: '🎯' })
  })

  it('returns defaults for invalid JSON', () => {
    store['manor-settings'] = 'not-json{{'
    const s = loadSettings()
    expect(s.accentColor).toBeNull()
    expect(s.agentOverrides).toEqual({})
  })

  it('handles partial/malformed data gracefully', () => {
    store['manor-settings'] = JSON.stringify({
      accentColor: 42,
      manorName: true,
      agentOverrides: 'not-an-object',
    })
    const s = loadSettings()
    expect(s.accentColor).toBeNull()
    expect(s.manorName).toBeNull()
    expect(s.manorEmoji).toBeNull()
    expect(s.manorIcon).toBeNull()
    expect(s.agentOverrides).toEqual({})
  })
})

describe('saveSettings', () => {
  it('persists settings to localStorage', () => {
    const settings = {
      accentColor: '#EF4444',
      manorName: 'Test',
      manorSubtitle: null,
      manorEmoji: null,
      manorIcon: null,
      iconBgHidden: false,
      emojiOnly: false,
      operatorName: null,
      agentOverrides: {},
    }
    saveSettings(settings)
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'manor-settings',
      JSON.stringify(settings),
    )
  })

  it('round-trips through load', () => {
    const settings = {
      accentColor: '#22C55E',
      manorName: 'Green HQ',
      manorSubtitle: 'Ops Center',
      manorEmoji: '🏠',
      manorIcon: 'data:image/png;base64,test',
      iconBgHidden: false,
      emojiOnly: false,
      operatorName: null,
      agentOverrides: {
        vera: { emoji: '🧙', profileImage: 'data:image/jpeg;base64,abc' },
      },
    }
    saveSettings(settings)
    const loaded = loadSettings()
    expect(loaded).toEqual(settings)
  })
})

describe('hexToAccentFill', () => {
  it('converts gold hex to rgba at 0.15 alpha', () => {
    expect(hexToAccentFill('#F5C518')).toBe('rgba(245,197,24,0.15)')
  })

  it('converts blue hex correctly', () => {
    expect(hexToAccentFill('#3B82F6')).toBe('rgba(59,130,246,0.15)')
  })

  it('converts black hex correctly', () => {
    expect(hexToAccentFill('#000000')).toBe('rgba(0,0,0,0.15)')
  })

  it('converts white hex correctly', () => {
    expect(hexToAccentFill('#FFFFFF')).toBe('rgba(255,255,255,0.15)')
  })
})
