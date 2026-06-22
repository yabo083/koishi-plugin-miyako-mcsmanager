import type { Context, Session } from 'koishi'
import { createMcsManagerClient } from './api'
import { Config } from './config'
import type { Config as MiyakoMcsConfig } from './config'
import { canUseCommand } from './permissions'
import type { PermissionSession } from './permissions'
import { createNamespaceState } from './state'
import { registerCommands } from './commands'

export const name = 'miyako-mcsmanager'
export const inject = ['http']
export { Config }

export function apply(ctx: Context, config: MiyakoMcsConfig) {
  const logger = ctx.logger(name)
  const client = createMcsManagerClient({
    baseUrl: config.baseUrl,
    remoteUuid: config.remoteUuid,
    apiKey: config.apiKey,
    httpGet: (url, options) => ctx.http.get(url, {
      responseType: 'json',
      headers: options?.headers,
    }),
    httpPut: (url, data, options) => ctx.http.put(url, data, {
      responseType: 'json',
      headers: options?.headers,
    }),
  })
  const state = createNamespaceState()
  const permissionConfig = {
    mode: config.permissionMode,
    allowSandbox: config.allowSandbox,
    entries: config.permissions,
  }

  registerCommands(ctx, client, state, (session) => {
    const permissionSession = toPermissionSession(session)
    const allowed = canUseCommand(permissionSession, permissionConfig)
    if (!allowed) {
      logger.warn(`permission denied: session=${JSON.stringify(summarizeSession(session, permissionSession))} entries=${JSON.stringify(summarizeEntries(config.permissions))}`)
    }
    return allowed
  })
}

export function toPermissionSession(session: Session): PermissionSession {
  const platform = session.platform ?? ''
  const userId = session.userId ?? ''
  if (isDirectSession(session)) {
    return {
      platform,
      type: 'private',
      targetId: userId,
      userId,
    }
  }
  if (session.guildId) {
    return {
      platform,
      type: 'group',
      targetId: session.guildId,
      userId,
    }
  }
  if (session.channelId && session.channelId !== session.userId) {
    return {
      platform,
      type: 'guild',
      targetId: session.channelId,
      userId,
    }
  }
  return {
    platform,
    type: 'private',
    targetId: userId,
    userId,
  }
}

function isDirectSession(session: Session) {
  const input = session as Session & { subtype?: string; type?: string }
  if (input.isDirect !== undefined) return Boolean(input.isDirect)
  if (input.subtype === 'private' || input.type === 'private') return true
  if (!input.guildId && input.channelId?.startsWith('private:')) return true
  return !input.guildId && (!input.channelId || input.channelId === input.userId)
}

function summarizeSession(session: Session, permissionSession: PermissionSession) {
  const input = session as Session & { subtype?: string; type?: string }
  return {
    platform: input.platform,
    isDirect: input.isDirect,
    subtype: input.subtype,
    type: input.type,
    userId: maskId(input.userId),
    channelId: maskId(input.channelId),
    guildId: maskId(input.guildId),
    mapped: {
      platform: permissionSession.platform,
      type: permissionSession.type,
      targetId: maskId(permissionSession.targetId),
      userId: maskId(permissionSession.userId),
    },
  }
}

function summarizeEntries(entries: MiyakoMcsConfig['permissions']) {
  return (entries ?? []).map((entry) => ({
    platform: String(entry.platform ?? 'onebot'),
    type: entry.type,
    id: maskId(entry.id),
    allowedUsers: String(entry.allowedUsers ?? '').split(/[\s,，]+/).filter(Boolean).map(maskId),
  }))
}

function maskId(value: unknown) {
  const text = String(value ?? '')
  if (!text) return ''
  if (text.length <= 4) return '*'.repeat(text.length)
  return `${text.slice(0, 2)}***${text.slice(-2)}`
}
