import type { Context, Session } from 'koishi'
import type { McsInstance, McsManagerClient, McsNodeStatus } from './api'
import type { NamespaceState } from './state'

export function formatInstanceList(instances: McsInstance[]) {
  if (instances.length === 0) return '未获取到任何实例。'
  return instances.map((instance, index) => {
    const players = instance.currentPlayers !== undefined && instance.maxPlayers !== undefined
      ? ` ${instance.currentPlayers}/${instance.maxPlayers}`
      : ''
    return `${index + 1}. ${instance.name} [${formatStatusWord(instance.status)}]${players}`
  }).join('\n')
}

export function formatStatus(instance: McsInstance, node?: McsNodeStatus) {
  const rows = [
    `实例：${instance.name}`,
    `状态：${formatStatusWord(instance.status)}`,
  ]
  if (instance.version) rows.push(`版本：${instance.version}`)
  if (instance.currentPlayers !== undefined && instance.maxPlayers !== undefined && instance.maxPlayers > 0) {
    rows.push(`人数：${instance.currentPlayers}/${instance.maxPlayers}`)
  }
  if (instance.address) rows.push(`地址：${instance.address}`)
  if (instance.process?.pid) rows.push(`进程：PID ${instance.process.pid}`)
  if (instance.process?.cpu !== undefined || instance.process?.memory !== undefined) {
    rows.push(`资源：${instance.process.cpu !== undefined ? `CPU ${instance.process.cpu.toFixed(2)}%` : 'CPU 未知'} / ${instance.process.memory !== undefined ? `内存 ${formatMemory(instance.process.memory)}` : '内存 未知'}`)
  }
  if (instance.process?.elapsed) rows.push(`运行：${formatDuration(instance.process.elapsed)}`)
  if (node) rows.push(`节点：${node.available ? '在线' : '离线'}${node.address ? ` ${node.address}` : ''}`)
  if (node?.version) rows.push(`节点版本：${node.version}`)
  if (node?.hostname) rows.push(`节点主机：${node.hostname}`)
  if (node?.runningInstances !== undefined && node.totalInstances !== undefined) rows.push(`节点实例：${node.runningInstances}/${node.totalInstances}`)
  if (node?.cpuUsage !== undefined || node?.memoryUsage !== undefined) {
    rows.push(`节点资源：${node.cpuUsage !== undefined ? `CPU ${node.cpuUsage.toFixed(2)}%` : 'CPU 未知'} / ${node.memoryUsage !== undefined ? `内存 ${node.memoryUsage.toFixed(2)}%` : '内存 未知'}`)
  }
  return rows.join('\n')
}

export function buildMinecraftCommand(kind: 'exec' | 'say' | 'whitelist' | 'op', args: string[]) {
  if (kind === 'exec') return args.length > 0 ? args.join(' ') : undefined
  if (kind === 'say') return args.length > 0 ? `say ${args.join(' ')}` : undefined

  if (kind === 'whitelist') {
    const [action, player] = args
    if (['list', 'ls'].includes(action) && args.length === 1) return undefined
    if (['on', 'off', 'reload'].includes(action) && args.length === 1) return `whitelist ${action}`
    if (action === 'add' && player && args.length === 2) return `whitelist add ${player}`
    if (['remove', 'rm'].includes(action) && player && args.length === 2) return `whitelist remove ${player}`
    if (action && args.length === 1 && /^[a-zA-Z0-9_]{3,16}$/.test(action)) return `whitelist add ${action}`
    return undefined
  }

  const [action, player] = args
  if (action === 'add' && player && args.length === 2) return `op ${player}`
  if (['remove', 'rm'].includes(action) && player && args.length === 2) return `deop ${player}`
  return undefined
}

export function getNativeCommandUsage(kind: 'whitelist' | 'op') {
  if (kind === 'whitelist') return '用法：\nmc wl on|off\nmc wl ls|reload\nmc wl add 玩家名\nmc wl rm 玩家名\nmc wl 玩家名'
  return '用法：\nmc op ls\nmc op add 玩家名\nmc op rm 玩家名'
}

export function isFileBackedQuery(kind: 'whitelist' | 'op', args: string[]) {
  return ['list', 'ls'].includes(args[0]) && args.length === 1 && (kind === 'whitelist' || kind === 'op')
}

export function formatNativeCommandResult(server: string, command: string, log?: string) {
  if (log) return `${server}\n${command}\n${log}`
  return `${server}\n${command}\n已发送，暂无新增日志。`
}

export function formatOps(ops: Array<{ name: string; level: number }>) {
  if (ops.length === 0) return 'OP 列表：空'
  return `OP 列表：\n${ops.map((op, index) => `${index + 1}. ${op.name} (level ${op.level})`).join('\n')}`
}

export function formatOpCommandResult(server: string, command: string, ops: Array<{ name: string; level: number }>) {
  return [
    `【实例】${server}`,
    `【实际执行指令】${command}`,
    `【最新OP 列表】${ops.length > 0 ? ops.map((op) => `${op.name} (level ${op.level})`).join('，') : '空'}`,
  ].join('\n')
}

export function formatWhitelist(whitelist: { enabled: boolean; enforced: boolean; players: string[] }) {
  return [
    `白名单：${whitelist.enabled ? '开启' : '关闭'}`,
    `强制白名单：${whitelist.enforced ? '开启' : '关闭'}`,
    `玩家：${whitelist.players.length > 0 ? whitelist.players.join(', ') : '空'}`,
  ].join('\n')
}

export function formatWhitelistCommandResult(server: string, command: string, whitelist: { enabled: boolean; enforced: boolean; players: string[] }) {
  return [
    `【实例】${server}`,
    `【实际执行指令】${command}`,
    `【白名单】${whitelist.enabled ? '开启' : '关闭'}`,
    `【强制白名单】${whitelist.enforced ? '开启' : '关闭'}`,
    `【最新白名单玩家】${whitelist.players.length > 0 ? whitelist.players.join(', ') : '空'}`,
  ].join('\n')
}

export function registerCommands(ctx: Context, client: McsManagerClient, state: NamespaceState, canUse: (session: Session) => boolean) {
  const requireAllowed = (session: Session) => canUse(session)
  const getActive = (session: Session) => state.getActiveInstance(getSessionKey(session))

  ctx.command('mc', 'MCSManager 实例管理')

  ctx.command('mc.list', '列出 MCSManager 实例')
    .action(async ({ session }) => {
      if (!session || !requireAllowed(session)) return '无权使用此指令。'
      const instances = await client.listInstances()
      state.setInstances(getSessionKey(session), instances)
      return `${formatInstanceList(instances)}\n使用 mc.use <序号> 选择实例。`
    })

  ctx.command('mc.use <index:number>', '选择当前会话实例')
    .action(({ session }, index) => {
      if (!session || !requireAllowed(session)) return '无权使用此指令。'
      const instance = state.selectInstance(getSessionKey(session), Math.trunc(index))
      return instance ? `已选择实例：${instance.name}` : '序号无效，请先执行 mc.list。'
    })

  ctx.command('mc.status', '查看当前实例状态')
    .alias('mca.s')
    .action(async ({ session }) => {
      if (!session || !requireAllowed(session)) return '无权使用此指令。'
      const active = getActive(session)
      if (!active) return '请先执行 mc.list，再用 mc.use <序号> 选择实例。'
      return formatStatus(await client.getInstance(active.uuid), await client.getNodeStatus())
    })

  ctx.command('mc.log [lines:number]', '查看当前实例日志')
    .action(async ({ session }, lines = 10) => {
      if (!session || !requireAllowed(session)) return '无权使用此指令。'
      const active = getActive(session)
      if (!active) return '请先执行 mc.list，再用 mc.use <序号> 选择实例。'
      return client.getLog(active.uuid, Math.max(1, Math.min(100, Math.trunc(lines))))
    })

  for (const action of ['start', 'stop', 'restart'] as const) {
    ctx.command(`mc.${action}`, `${action} 当前实例`)
      .action(async ({ session }) => {
        if (!session || !requireAllowed(session)) return '无权使用此指令。'
        const active = getActive(session)
        if (!active) return '请先执行 mc.list，再用 mc.use <序号> 选择实例。'
        const result = await client.controlInstance(active.uuid, action)
        return result.ok ? `${active.name} ${action} 指令已发送。` : `${active.name} ${action} 失败：${result.message ?? '未知错误'}`
      })
  }

  registerNativeCommand(ctx, client, state, canUse, 'mc.exec <command:text>', 'exec')
  registerNativeCommand(ctx, client, state, canUse, 'mc.say <message:text>', 'say')
  registerNativeCommand(ctx, client, state, canUse, 'mc.whitelist <args:text>', 'whitelist')
  registerNativeCommand(ctx, client, state, canUse, 'mc.wl <args:text>', 'whitelist')
  registerNativeCommand(ctx, client, state, canUse, 'mc.op <args:text>', 'op')
}

function registerNativeCommand(ctx: Context, client: McsManagerClient, state: NamespaceState, canUse: (session: Session) => boolean, declaration: string, kind: 'exec' | 'say' | 'whitelist' | 'op') {
  ctx.command(declaration)
    .action(async ({ session }, raw = '') => {
      if (!session || !canUse(session)) return '无权使用此指令。'
      const active = state.getActiveInstance(getSessionKey(session))
      if (!active) return '请先执行 mc.list，再用 mc.use <序号> 选择实例。'
      const args = splitArgs(raw)
      if (args.length === 0 && (kind === 'whitelist' || kind === 'op')) return getNativeCommandUsage(kind)
      if (kind === 'whitelist' && isFileBackedQuery(kind, args)) return formatWhitelist(await client.getWhitelist(active.uuid))
      if (kind === 'op' && isFileBackedQuery(kind, args)) return formatOps(await client.getOps(active.uuid))
      const command = buildMinecraftCommand(kind, args)
      if (!command) return kind === 'whitelist' || kind === 'op' ? getNativeCommandUsage(kind) : '参数无效。'
      const before = kind === 'exec' || kind === 'say' ? await client.getLog(active.uuid, 200) : ''
      const result = await client.sendCommand(active.uuid, command)
      if (!result.ok) return `${active.name} 执行失败：${result.message ?? '未知错误'}`
      await new Promise((resolve) => setTimeout(resolve, 500))
      if (kind === 'whitelist') return formatWhitelistCommandResult(active.name, command, await waitForWhitelist(client, active.uuid, args))
      if (kind === 'op') return formatOpCommandResult(active.name, command, await waitForOps(client, active.uuid, args))
      return formatNativeCommandResult(active.name, command, await client.getNewLog(active.uuid, before, command, 5))
    })
}

async function waitForOps(client: McsManagerClient, uuid: string, args: string[]) {
  return waitForFileState(() => client.getOps(uuid), (ops) => matchesOpTarget(args, ops))
}

async function waitForWhitelist(client: McsManagerClient, uuid: string, args: string[]) {
  return waitForFileState(() => client.getWhitelist(uuid), (whitelist) => matchesWhitelistTarget(args, whitelist))
}

async function waitForFileState<T>(read: () => Promise<T>, matches: (value: T) => boolean | undefined) {
  let latest = await read()
  for (let attempt = 0; attempt < 4; attempt++) {
    const matched = matches(latest)
    if (matched !== false) return latest
    await new Promise((resolve) => setTimeout(resolve, 500))
    latest = await read()
  }
  return latest
}

function matchesOpTarget(args: string[], ops: Array<{ name: string }>) {
  const [action, player] = args
  if (action === 'add' && player && args.length === 2) return hasName(ops.map((op) => op.name), player)
  if (['remove', 'rm'].includes(action) && player && args.length === 2) return !hasName(ops.map((op) => op.name), player)
  return undefined
}

function matchesWhitelistTarget(args: string[], whitelist: { enabled: boolean; players: string[] }) {
  const [action, player] = args
  if (action === 'on' && args.length === 1) return whitelist.enabled
  if (action === 'off' && args.length === 1) return !whitelist.enabled
  if (action === 'add' && player && args.length === 2) return hasName(whitelist.players, player)
  if (['remove', 'rm'].includes(action) && player && args.length === 2) return !hasName(whitelist.players, player)
  if (action && args.length === 1 && /^[a-zA-Z0-9_]{3,16}$/.test(action)) return hasName(whitelist.players, action)
  return undefined
}

function hasName(names: string[], name: string) {
  return names.some((item) => item.toLowerCase() === name.toLowerCase())
}

export function getSessionKey(session: Pick<Session, 'platform' | 'guildId' | 'channelId' | 'userId'>) {
  if (session.guildId) return `${session.platform}:group:${session.guildId}`
  if (session.channelId && session.channelId !== session.userId) return `${session.platform}:guild:${session.channelId}`
  return `${session.platform}:private:${session.userId}`
}

function splitArgs(raw: string) {
  return raw.trim().split(/\s+/).filter(Boolean)
}

function formatStatusWord(status: number) {
  if (status === 3) return '运行'
  if (status === 0) return '未运行'
  return `状态${status}`
}

function formatMemory(value: number) {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} GB`
  if (value >= 1024) return `${(value / 1024).toFixed(1)} MB`
  return `${value} KB`
}

function formatDuration(value: number) {
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
