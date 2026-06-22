export type PermissionMode = 'whitelist' | 'blacklist'
export type PermissionTargetType = 'group' | 'private' | 'guild'

export interface PermissionEntry {
  platform: string
  type: PermissionTargetType
  id: string
  allowedUsers: string
}

export interface PermissionConfig {
  mode: PermissionMode
  allowSandbox?: boolean
  entries: PermissionEntry[]
}

export interface PermissionSession {
  platform: string
  type: PermissionTargetType
  targetId: string
  userId: string
}

export function canUseCommand(session: PermissionSession, config: PermissionConfig) {
  if (config.allowSandbox !== false && session.platform.startsWith('sandbox')) return true

  const matched = config.entries.some((entry) => matchesEntry(session, entry))
  return (config.mode ?? 'whitelist') === 'whitelist' ? matched : !matched
}

function matchesEntry(session: PermissionSession, entry: PermissionEntry) {
  if (toText(entry.platform ?? 'onebot') !== toText(session.platform)) return false
  if (entry.type !== session.type) return false
  if (toText(entry.id) !== toText(session.targetId)) return false
  if (entry.type === 'private') return true

  const allowedUsers = toText(entry.allowedUsers ?? '').trim().split(/[\s,，]+/).filter(Boolean)
  return allowedUsers.length === 0 || allowedUsers.includes(toText(session.userId))
}

function toText(value: unknown) {
  return String(value ?? '')
}
