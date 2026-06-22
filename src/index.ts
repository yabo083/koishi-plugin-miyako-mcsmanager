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

  registerCommands(ctx, client, state, (session) => canUseCommand(toPermissionSession(session), {
    mode: config.permissionMode,
    allowSandbox: config.allowSandbox,
    entries: config.permissions,
  }))
}

function toPermissionSession(session: Session): PermissionSession {
  const platform = session.platform ?? ''
  const userId = session.userId ?? ''
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
