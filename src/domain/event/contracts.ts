import {
  EVENT_TYPES,
  SCOPE_TYPES,
  SOURCE_TYPES,
  type EventType,
  type ScopeType,
  type SourceType,
} from './types'

export function isValidEventType(value: string): value is EventType {
  return EVENT_TYPES.includes(value as EventType)
}

export function isValidSourceType(value: string): value is SourceType {
  return SOURCE_TYPES.includes(value as SourceType)
}

export function isValidScopeType(value: string): value is ScopeType {
  return SCOPE_TYPES.includes(value as ScopeType)
}
