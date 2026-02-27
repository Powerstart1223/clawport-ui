'use client'
import type { Agent } from '@/lib/types'
import type { ConversationStore } from '@/lib/conversations'

interface AgentListProps {
  agents: Agent[]
  conversations: ConversationStore
  activeId: string | null
  onSelect: (agent: Agent) => void
}

export function AgentList({ agents, conversations, activeId, onSelect }: AgentListProps) {
  const sorted = [...agents].sort((a, b) => {
    const ca = conversations[a.id]
    const cb = conversations[b.id]
    if (ca && cb) return cb.lastActivity - ca.lastActivity
    if (ca) return -1
    if (cb) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div style={{
      width: 280,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--sidebar-bg)',
      backdropFilter: 'var(--sidebar-backdrop)',
      WebkitBackdropFilter: 'var(--sidebar-backdrop)',
      borderRight: '1px solid var(--separator)',
      height: '100%',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: '1px solid var(--separator)',
        background: 'var(--material-regular)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        flexShrink: 0,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)', margin: 0 }}>
          Messages
        </h2>
        <div style={{
          marginTop: 10,
          background: 'var(--fill-tertiary)',
          borderRadius: 12,
          padding: '7px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>&#128269;</span>
          <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Search agents...</span>
        </div>
      </div>

      {/* Agent list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {sorted.map(agent => {
          const conv = conversations[agent.id]
          const lastMsg = conv?.messages[conv.messages.length - 1]
          const unread = conv?.unread || 0
          const isActive = agent.id === activeId

          const preview = lastMsg
            ? lastMsg.content.replace(/[#*`]/g, '').slice(0, 55) + (lastMsg.content.length > 55 ? '\u2026' : '')
            : agent.description?.slice(0, 55) || 'Start a conversation'

          const timeLabel = lastMsg ? formatTime(lastMsg.timestamp) : ''

          return (
            <button
              key={agent.id}
              onClick={() => onSelect(agent)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                background: isActive ? 'var(--accent-fill, rgba(255,255,255,0.12))' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 100ms ease',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--fill-secondary, rgba(255,255,255,0.06))' }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              {/* Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 46,
                  height: 46,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${agent.color}cc, ${agent.color}55)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  boxShadow: isActive ? `0 0 0 2px var(--accent)` : 'none',
                  border: `2px solid ${agent.color}44`,
                }}>
                  {agent.emoji}
                </div>
                <div style={{
                  position: 'absolute',
                  bottom: 1,
                  right: 1,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: 'var(--system-green, #30d158)',
                  border: '2px solid var(--bg, #000)',
                }} />
              </div>

              {/* Text content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                  <span style={{
                    fontSize: 15,
                    fontWeight: unread > 0 ? 700 : 600,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 130,
                  }}>
                    {agent.name}
                  </span>
                  <span style={{ fontSize: 11, color: unread > 0 ? 'var(--accent)' : 'var(--text-tertiary)', flexShrink: 0, marginLeft: 4 }}>
                    {timeLabel}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: 13,
                    color: unread > 0 ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                    fontWeight: unread > 0 ? 500 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 160,
                  }}>
                    {lastMsg?.role === 'user' ? 'You: ' : ''}{preview}
                  </span>
                  {unread > 0 && (
                    <div style={{
                      flexShrink: 0,
                      marginLeft: 6,
                      background: 'var(--accent)',
                      color: '#000',
                      borderRadius: '50%',
                      width: 20,
                      height: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      {unread > 9 ? '9+' : unread}
                    </div>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function formatTime(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff/60000)}m`
  if (diff < 86400000) return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
