import assert from 'node:assert/strict'
import type { McsManagerClient } from '../src/api'
import { buildMinecraftCommand, formatInstanceList, formatNativeCommandResult, formatOps, formatStatus, formatWhitelist, getNativeCommandUsage, getSessionKey, isFileBackedQuery, parseListPlayers, registerCommands } from '../src/commands'
import { createNamespaceState } from '../src/state'

function testFormatsNumberedInstanceList() {
  const output = formatInstanceList([
    { uuid: 'uuid-a', name: 'Alpha', status: 0 },
    { uuid: 'uuid-b', name: 'Beta', status: 3, currentPlayers: 2, maxPlayers: 10 },
  ])

  assert.equal(output, '1. Alpha [未运行]\n2. Beta [运行] 2/10')
}

function testFormatsAccurateStatus() {
  const output = formatStatus({
    uuid: 'uuid-b',
    name: 'Beta',
    status: 3,
    version: '1.20.1',
    currentPlayers: 2,
    maxPlayers: 10,
    address: '127.0.0.1:25565',
    process: {
      cpu: 1.5,
      memory: 1658880,
      elapsed: 3661,
      pid: 3651814,
    },
  })

  assert.equal(output, '实例：Beta\n状态：运行\n在线人数：2/10\n在线玩家：无')
}

function testFormatsStatusWithNodeOnly() {
  const output = formatStatus({
    uuid: 'uuid-b',
    name: 'No Flesh Within Chest 0.3.2',
    status: 0,
    currentPlayers: 0,
    maxPlayers: 0,
    address: '127.0.0.1:25565',
  }, {
    available: true,
    address: 'localhost:24444',
    version: '4.11.0',
    hostname: 'BREN9NP',
    runningInstances: 0,
    totalInstances: 1,
    cpuUsage: 3.36,
    memoryUsage: 25.95,
  })

  assert.equal(output, '实例：No Flesh Within Chest 0.3.2\n状态：未运行\n在线人数：0/0\n在线玩家：无\n节点资源：CPU 3.36% / 内存 25.95%')
}

function testFormatsStatusWithOnlinePlayers() {
  const output = formatStatus({
    uuid: 'uuid-b',
    name: 'No Flesh Within Chest 0.3.2',
    status: 3,
    currentPlayers: 2,
    maxPlayers: 20,
    onlinePlayers: ['Steve', 'Alex'],
  }, {
    available: true,
    cpuUsage: 3.01,
    memoryUsage: 67.87,
  })

  assert.equal(output, '实例：No Flesh Within Chest 0.3.2\n状态：运行\n在线人数：2/20\n在线玩家：Steve，Alex\n节点资源：CPU 3.01% / 内存 67.87%')
}

function testParsesListPlayersOutput() {
  assert.deepEqual(parseListPlayers('There are 2 of a max of 20 players online: Steve, Alex'), {
    currentPlayers: 2,
    maxPlayers: 20,
    onlinePlayers: ['Steve', 'Alex'],
  })
  assert.deepEqual(parseListPlayers('There are 0 of a max of 20 players online: '), {
    currentPlayers: 0,
    maxPlayers: 20,
    onlinePlayers: [],
  })
}

function testBuildsNativeMinecraftCommands() {
  assert.equal(buildMinecraftCommand('say', ['hello', 'world']), 'say hello world')
  assert.equal(buildMinecraftCommand('whitelist', ['add', 'Steve']), 'whitelist add Steve')
  assert.equal(buildMinecraftCommand('whitelist', ['Steve']), 'whitelist add Steve')
  assert.equal(buildMinecraftCommand('whitelist', ['reload']), 'whitelist reload')
  assert.equal(buildMinecraftCommand('whitelist', ['on']), 'whitelist on')
  assert.equal(buildMinecraftCommand('whitelist', ['off']), 'whitelist off')
  assert.equal(buildMinecraftCommand('whitelist', ['list']), undefined)
  assert.equal(buildMinecraftCommand('whitelist', ['ls']), undefined)
  assert.equal(buildMinecraftCommand('op', ['add', 'Steve']), 'op Steve')
  assert.equal(buildMinecraftCommand('op', ['remove', 'Steve']), 'deop Steve')
  assert.equal(buildMinecraftCommand('op', ['rm', 'Steve']), 'deop Steve')
  assert.equal(buildMinecraftCommand('op', ['list']), undefined)
  assert.equal(buildMinecraftCommand('op', ['ls']), undefined)
  assert.equal(buildMinecraftCommand('exec', ['time', 'set', 'day']), 'time set day')
}

function testRejectsInvalidNativeMinecraftCommands() {
  assert.equal(buildMinecraftCommand('say', []), undefined)
  assert.equal(buildMinecraftCommand('whitelist', ['ban', 'Steve']), undefined)
  assert.equal(buildMinecraftCommand('whitelist', ['delete', 'Steve']), undefined)
  assert.equal(buildMinecraftCommand('op', ['add']), undefined)
  assert.equal(buildMinecraftCommand('exec', []), undefined)
}

function testShowsNativeCommandUsage() {
  assert.equal(getNativeCommandUsage('whitelist'), '用法：\nmc wl on|off\nmc wl ls|reload\nmc wl add 玩家名\nmc wl rm 玩家名\nmc wl 玩家名')
  assert.equal(getNativeCommandUsage('op'), '用法：\nmc op ls\nmc op add 玩家名\nmc op rm 玩家名')
}

function testDetectsFileBackedQueries() {
  assert.equal(isFileBackedQuery('whitelist', ['list']), true)
  assert.equal(isFileBackedQuery('whitelist', ['ls']), true)
  assert.equal(isFileBackedQuery('op', ['list']), true)
  assert.equal(isFileBackedQuery('op', ['ls']), true)
  assert.equal(isFileBackedQuery('whitelist', ['add', 'Steve']), false)
}

function testFormatsNativeCommandResult() {
  assert.equal(formatNativeCommandResult('Server', 'whitelist add Steve', '[02:49:10] Added Steve'), 'Server\nwhitelist add Steve\n[02:49:10] Added Steve')
  assert.equal(formatNativeCommandResult('Server', 'whitelist add Steve'), 'Server\nwhitelist add Steve\n已发送，暂无新增日志。')
}

function testFormatsOpsFromFile() {
  assert.equal(formatOps([{ name: 'Steve', level: 4 }, { name: 'Alex', level: 3 }]), 'OP 列表：\n1. Steve (level 4)\n2. Alex (level 3)')
  assert.equal(formatOps([]), 'OP 列表：空')
}

function testFormatsWhitelistFromFiles() {
  assert.equal(formatWhitelist({ enabled: true, enforced: false, players: ['Steve'] }), '白名单：开启\n强制白名单：关闭\n玩家：Steve')
  assert.equal(formatWhitelist({ enabled: false, enforced: false, players: [] }), '白名单：关闭\n强制白名单：关闭\n玩家：空')
}

function testPrivateChannelSessionKeyUsesUserId() {
  const key = getSessionKey({
    platform: 'onebot',
    userId: '2058561180',
    channelId: 'private:2058561180',
  })

  assert.equal(key, 'onebot:private:2058561180')
}

async function testOpListReadsFileAndDoesNotSendConsoleCommand() {
  const { actions, ctx } = createCommandHarness()
  const state = createNamespaceState()
  state.setInstances('onebot:group:1000', [{ uuid: 'uuid-1', name: 'Server', status: 3 }])
  state.selectInstance('onebot:group:1000', 1)
  const client = createClientStub({
    getOps: async () => [{ name: 'AIzhang2025', level: 4 }],
    sendCommand: async () => { throw new Error('sendCommand must not be called for mc op ls') },
  })

  registerCommands(ctx, client, state, () => true)
  const output = await actions.get('mc.op')!({ session: groupSession }, 'ls')

  assert.equal(output, 'OP 列表：\n1. AIzhang2025 (level 4)')
}

async function testWhitelistListReadsFileAndDoesNotSendConsoleCommand() {
  const { actions, ctx } = createCommandHarness()
  const state = createNamespaceState()
  state.setInstances('onebot:group:1000', [{ uuid: 'uuid-1', name: 'Server', status: 3 }])
  state.selectInstance('onebot:group:1000', 1)
  const client = createClientStub({
    getWhitelist: async () => ({ enabled: false, enforced: false, players: [] }),
    sendCommand: async () => { throw new Error('sendCommand must not be called for mc wl list') },
  })

  registerCommands(ctx, client, state, () => true)
  const output = await actions.get('mc.wl')!({ session: groupSession }, 'list')

  assert.equal(output, '白名单：关闭\n强制白名单：关闭\n玩家：空')
}

async function testOpMutationReadsFileAfterSendingCommand() {
  const { actions, ctx } = createCommandHarness()
  const state = createNamespaceState()
  state.setInstances('onebot:group:1000', [{ uuid: 'uuid-1', name: 'No Flesh Within Chest 0.3.2', status: 3 }])
  state.selectInstance('onebot:group:1000', 1)
  const sent: string[] = []
  let reads = 0
  const client = createClientStub({
    sendCommand: async (_uuid, command) => {
      sent.push(command)
      return { ok: true }
    },
    getLog: async () => { throw new Error('getLog must not be called for mc op add') },
    getNewLog: async () => { throw new Error('getNewLog must not be called for mc op add') },
    getOps: async () => {
      reads += 1
      const existing = [
        { name: 'AIzhang2025', level: 4 },
        { name: 'miyakko_de', level: 4 },
        { name: 'LaoLiangZai', level: 4 },
      ]
      return reads === 1 ? existing : [...existing, { name: 'paipai_paipai', level: 4 }]
    },
  })

  registerCommands(ctx, client, state, () => true)
  const output = await actions.get('mc.op')!({ session: groupSession }, 'add paipai_paipai')

  assert.deepEqual(sent, ['op paipai_paipai'])
  assert.equal(reads, 2)
  assert.equal(output, '【实例】No Flesh Within Chest 0.3.2\n【实际执行指令】op paipai_paipai\n【最新OP 列表】AIzhang2025 (level 4)，miyakko_de (level 4)，LaoLiangZai (level 4)，paipai_paipai (level 4)')
}

async function testWhitelistMutationReadsFileAfterSendingCommand() {
  const { actions, ctx } = createCommandHarness()
  const state = createNamespaceState()
  state.setInstances('onebot:group:1000', [{ uuid: 'uuid-1', name: 'No Flesh Within Chest 0.3.2', status: 3 }])
  state.selectInstance('onebot:group:1000', 1)
  const sent: string[] = []
  let reads = 0
  const client = createClientStub({
    sendCommand: async (_uuid, command) => {
      sent.push(command)
      return { ok: true }
    },
    getLog: async () => { throw new Error('getLog must not be called for mc wl add') },
    getNewLog: async () => { throw new Error('getNewLog must not be called for mc wl add') },
    getWhitelist: async () => {
      reads += 1
      const existing = ['AIzhang2025', 'LaoLiangZai']
      return { enabled: true, enforced: false, players: reads === 1 ? existing : ['AIzhang2025', 'miyakko_de', 'LaoLiangZai'] }
    },
  })

  registerCommands(ctx, client, state, () => true)
  const output = await actions.get('mc.wl')!({ session: groupSession }, 'add miyakko_de')

  assert.deepEqual(sent, ['whitelist add miyakko_de'])
  assert.equal(reads, 2)
  assert.equal(output, '【实例】No Flesh Within Chest 0.3.2\n【实际执行指令】whitelist add miyakko_de\n【白名单】开启\n【强制白名单】关闭\n【最新白名单玩家】AIzhang2025, miyakko_de, LaoLiangZai')
}

async function testStatusCommandRefreshesPlayersWithListCommand() {
  const { actions, ctx } = createCommandHarness()
  const state = createNamespaceState()
  state.setInstances('onebot:group:1000', [{ uuid: 'uuid-1', name: 'No Flesh Within Chest 0.3.2', status: 3 }])
  state.selectInstance('onebot:group:1000', 1)
  const sent: string[] = []
  const client = createClientStub({
    getInstance: async () => ({ uuid: 'uuid-1', name: 'No Flesh Within Chest 0.3.2', status: 3 }),
    getNodeStatus: async () => ({ available: true, cpuUsage: 3.01, memoryUsage: 67.87 }),
    sendCommand: async (_uuid, command) => {
      sent.push(command)
      return { ok: true }
    },
    getLog: async () => 'old tail line',
    getNewLog: async () => 'There are 2 of a max of 20 players online: Steve, Alex',
  })

  registerCommands(ctx, client, state, () => true)
  const output = await actions.get('mc.status')!({ session: groupSession })

  assert.deepEqual(sent, ['list'])
  assert.equal(output, '实例：No Flesh Within Chest 0.3.2\n状态：运行\n在线人数：2/20\n在线玩家：Steve，Alex\n节点资源：CPU 3.01% / 内存 67.87%')
}

type CommandAction = (argv: { session: typeof groupSession }, raw?: string) => unknown

const groupSession = {
  platform: 'onebot',
  guildId: '1000',
  channelId: '1000',
  userId: '2000',
}

function createCommandHarness() {
  const actions = new Map<string, CommandAction>()
  const ctx = {
    command(declaration: string) {
      const name = declaration.split(' ')[0]
      const chain = {
        alias() { return chain },
        action(action: CommandAction) {
          actions.set(name, action)
          return chain
        },
      }
      return chain
    },
  } as any
  return { actions, ctx }
}

function createClientStub(overrides: Partial<McsManagerClient>): McsManagerClient {
  return {
    listInstances: async () => [],
    getInstance: async () => ({ uuid: 'uuid-1', name: 'Server', status: 3 }),
    getNodeStatus: async () => undefined,
    controlInstance: async () => ({ ok: true }),
    sendCommand: async () => ({ ok: true }),
    getLog: async () => '',
    getNewLog: async () => '',
    readFile: async () => '',
    getOps: async () => [],
    getWhitelist: async () => ({ enabled: false, enforced: false, players: [] }),
    ...overrides,
  }
}

async function main() {
  testFormatsNumberedInstanceList()
  testFormatsAccurateStatus()
  testFormatsStatusWithNodeOnly()
  testFormatsStatusWithOnlinePlayers()
  testParsesListPlayersOutput()
  testBuildsNativeMinecraftCommands()
  testRejectsInvalidNativeMinecraftCommands()
  testShowsNativeCommandUsage()
  testDetectsFileBackedQueries()
  testFormatsNativeCommandResult()
  testFormatsOpsFromFile()
  testFormatsWhitelistFromFiles()
  testPrivateChannelSessionKeyUsesUserId()
  await testOpListReadsFileAndDoesNotSendConsoleCommand()
  await testWhitelistListReadsFileAndDoesNotSendConsoleCommand()
  await testOpMutationReadsFileAfterSendingCommand()
  await testWhitelistMutationReadsFileAfterSendingCommand()
  await testStatusCommandRefreshesPlayersWithListCommand()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
