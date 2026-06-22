import { Schema } from 'koishi'
import type { PermissionEntry, PermissionMode } from './permissions'

export interface Config {
  baseUrl: string
  remoteUuid: string
  apiKey: string
  permissionMode: PermissionMode
  allowSandbox: boolean
  permissions: PermissionEntry[]
  logLines: number
}

export const defaultConfig: Config = {
  baseUrl: '',
  remoteUuid: '',
  apiKey: '',
  permissionMode: 'whitelist',
  allowSandbox: true,
  permissions: [],
  logLines: 10,
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    baseUrl: Schema.string().description('MCSManager 面板地址，需包含 http:// 或 https://。').required(),
    remoteUuid: Schema.string().description('MCSManager 守护进程 ID / DaemonId / GID。').required(),
    apiKey: Schema.string().role('secret').description('MCSManager API Token。').required(),
    logLines: Schema.number().min(1).max(100).default(defaultConfig.logLines).description('mc.log 默认日志行数。'),
  }).description('MCSManager 连接设置'),
  Schema.object({
    permissionMode: Schema.union(['whitelist', 'blacklist'] as const).default(defaultConfig.permissionMode).description('权限表模式：白名单仅允许匹配项，黑名单拒绝匹配项。'),
    allowSandbox: Schema.boolean().default(defaultConfig.allowSandbox).description('是否允许沙盒绕过权限表，便于本机调试。'),
    permissions: Schema.array(Schema.object({
      platform: Schema.string().default('onebot').description('平台，默认 onebot。'),
      type: Schema.union(['group', 'private', 'guild'] as const).default('group').description('类型：群聊、私聊或频道。'),
      id: Schema.string().required().description('群号、QQ 用户 ID 或频道 ID。'),
      allowedUsers: Schema.string().default('').description('群聊/频道内允许或拒绝的 QQ 号，多个用逗号或空格分隔；留空表示整个目标。私聊忽略此项。'),
    })).role('table').default(defaultConfig.permissions).description('权限管理表。'),
  }).description('权限设置'),
]) as Schema<Config>
