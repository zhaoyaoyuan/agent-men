export const EVENT_TYPES = [
  'message',
  'tool_call',
  'tool_result',
  'decision',
  'error',
  'feedback',
  'system',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

export const SOURCE_TYPES = ['claude', 'cursor', 'sdk', 'cli', 'mcp', 'system', 'external'] as const

export type SourceType = (typeof SOURCE_TYPES)[number]

export const SCOPE_TYPES = ['project', 'session', 'conversation', 'message'] as const

export type ScopeType = (typeof SCOPE_TYPES)[number]
