import { EVENT_TYPES, SCOPE_TYPES, SOURCE_TYPES, } from './types';
export function isValidEventType(value) {
    return EVENT_TYPES.includes(value);
}
export function isValidSourceType(value) {
    return SOURCE_TYPES.includes(value);
}
export function isValidScopeType(value) {
    return SCOPE_TYPES.includes(value);
}
