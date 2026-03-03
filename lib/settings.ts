// Settings types + localStorage helpers for Manor UI

export interface AgentOverride {
  emoji?: string
  profileImage?: string // base64 data URL
}

export interface ManorSettings {
  accentColor: string | null
  manorName: string | null
  manorSubtitle: string | null
  manorEmoji: string | null
  manorIcon: string | null // base64 data URL for custom icon image
  iconBgHidden: boolean // hide colored background on sidebar logo
  emojiOnly: boolean // show emoji avatars without colored background
  operatorName: string | null
  agentOverrides: Record<string, AgentOverride>
}

const STORAGE_KEY = 'manor-settings'

export const DEFAULTS: ManorSettings = {
  accentColor: null,
  manorName: null,
  manorSubtitle: null,
  manorEmoji: null,
  manorIcon: null,
  iconBgHidden: false,
  emojiOnly: false,
  operatorName: null,
  agentOverrides: {},
}

export function loadSettings(): ManorSettings {
  if (typeof window === 'undefined') return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    return {
      accentColor: typeof parsed.accentColor === 'string' ? parsed.accentColor : null,
      manorName: typeof parsed.manorName === 'string' ? parsed.manorName : null,
      manorSubtitle: typeof parsed.manorSubtitle === 'string' ? parsed.manorSubtitle : null,
      manorEmoji: typeof parsed.manorEmoji === 'string' ? parsed.manorEmoji : null,
      manorIcon: typeof parsed.manorIcon === 'string' ? parsed.manorIcon : null,
      iconBgHidden: typeof parsed.iconBgHidden === 'boolean' ? parsed.iconBgHidden : false,
      emojiOnly: typeof parsed.emojiOnly === 'boolean' ? parsed.emojiOnly : false,
      operatorName: typeof parsed.operatorName === 'string' ? parsed.operatorName : null,
      agentOverrides:
        parsed.agentOverrides && typeof parsed.agentOverrides === 'object'
          ? parsed.agentOverrides
          : {},
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(settings: ManorSettings): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {}
}

/** Convert hex color to rgba at 0.15 alpha for accent-fill backgrounds */
export function hexToAccentFill(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},0.15)`
}
