import assert from 'node:assert/strict'
import { createMcsManagerClient } from '../src/api'

async function testListInstancesUsesMcsmanager9Endpoint() {
  const requested: string[] = []
  const client = createMcsManagerClient({
    baseUrl: 'http://panel.local:23333/',
    remoteUuid: 'daemon-1',
    apiKey: 'secret token',
    httpGet: async (url) => {
      requested.push(url)
      return {
        status: 200,
        data: {
          data: [
            {
              instanceUuid: 'uuid-1',
              status: 3,
              config: { nickname: 'Main', pingConfig: { ip: '127.0.0.1', port: 25565 } },
              info: { version: '1.20.1', currentPlayers: 2, maxPlayers: 10 },
            },
          ],
        },
      }
    },
  })

  const instances = await client.listInstances()

  assert.equal(requested.length, 1)
  assert.equal(requested[0], 'http://panel.local:23333/api/service/remote_service_instances?page=1&page_size=100&status=&instance_name=&remote_uuid=daemon-1&apikey=secret%20token')
  assert.deepEqual(instances, [
    {
      uuid: 'uuid-1',
      name: 'Main',
      status: 3,
      version: '1.20.1',
      currentPlayers: 2,
      maxPlayers: 10,
      address: '127.0.0.1:25565',
    },
  ])
}

async function testListInstancesFallsBackToMcsmanager10Endpoint() {
  const requested: string[] = []
  const client = createMcsManagerClient({
    baseUrl: 'http://panel.local',
    remoteUuid: 'daemon-1',
    apiKey: 'secret',
    httpGet: async (url) => {
      requested.push(url)
      if (requested.length === 1) {
        return { status: 200, data: { maxPage: 2, data: [] } }
      }
      return {
        status: 200,
        data: {
          data: [
            {
              instanceUuid: 'uuid-2',
              status: 0,
              config: { nickname: 'Test', pingConfig: { ip: '', port: 25565 } },
              info: { version: '', currentPlayers: 0, maxPlayers: 0 },
            },
          ],
        },
      }
    },
  })

  const instances = await client.listInstances()

  assert.equal(requested.length, 2)
  assert.equal(requested[1], 'http://panel.local/api/service/remote_service_instances?page=1&page_size=100&status=&instance_name=&daemonId=daemon-1&token=secret')
  assert.equal(instances[0].name, 'Test')
}

async function testSendCommandEncodesMinecraftCommand() {
  let requested = ''
  const client = createMcsManagerClient({
    baseUrl: 'http://panel.local',
    remoteUuid: 'daemon-1',
    apiKey: 'secret',
    httpGet: async (url) => {
      requested = url
      return { status: 200, time: 1710000000000, data: 'ok' }
    },
  })

  const result = await client.sendCommand('uuid-1', 'say hello world')

  assert.equal(requested, 'http://panel.local/api/protected_instance/command?remote_uuid=daemon-1&uuid=uuid-1&apikey=secret&command=say%20hello%20world')
  assert.equal(result.ok, true)
}

async function testGetLogStripsAnsiAndReturnsTail() {
  const client = createMcsManagerClient({
    baseUrl: 'http://panel.local',
    remoteUuid: 'daemon-1',
    apiKey: 'secret',
    httpGet: async () => ({
      status: 200,
      data: '\u001b[32mline1\u001b[0m\nline2\nline3',
    }),
  })

  const log = await client.getLog('uuid-1', 2)

  assert.equal(log, 'line2\nline3')
}

async function testGetLogOmitsMcsmanagerLongOutputSentinel() {
  const client = createMcsManagerClient({
    baseUrl: 'http://panel.local',
    remoteUuid: 'daemon-1',
    apiKey: 'secret',
    httpGet: async () => ({
      status: 200,
      data: '[MCSMANAGER] The instantaneous output content is too long and has been rejected.\n[03:29:46] latest line\n>',
    }),
  })

  const log = await client.getLog('uuid-1', 5)

  assert.equal(log, '[03:29:46] latest line')
}

async function testGetLogPrefersLatestLogFileOverRejectedOutputlog() {
  const client = createMcsManagerClient({
    baseUrl: 'http://panel.local',
    remoteUuid: 'daemon-1',
    apiKey: 'secret',
    httpGet: async () => ({
      status: 200,
      data: '[MCSMANAGER] The instantaneous output content is too long and has been rejected.',
    }),
    httpPut: async (_url, data) => {
      assert.deepEqual(data, { target: 'logs/latest.log' })
      return { status: 200, data: 'old line\n[03:29:46] real latest line' }
    },
  })

  const log = await client.getLog('uuid-1', 1)

  assert.equal(log, '[03:29:46] real latest line')
}

async function testGetLogNormalizesMinecraftChineseTimestamp() {
  const client = createMcsManagerClient({
    baseUrl: 'http://panel.local',
    remoteUuid: 'daemon-1',
    apiKey: 'secret',
    httpGet: async () => ({ status: 200, data: '' }),
    httpPut: async () => ({
      status: 200,
      data: '[236月2026 06:20:13.683] [Server thread/INFO] [net.minecraft.server.MinecraftServer/]: [Not Secure]',
    }),
  })

  const log = await client.getLog('uuid-1', 1)

  assert.equal(log, '[2026-06-23 06:20:13.683] [Server thread/INFO] [net.minecraft.server.MinecraftServer/]: [Not Secure]')
}

async function testReadsInstanceFileContent() {
  let requested = ''
  let body: unknown
  const client = createMcsManagerClient({
    baseUrl: 'http://panel.local',
    remoteUuid: 'daemon-1',
    apiKey: 'secret',
    httpGet: async () => ({ status: 200, data: '' }),
    httpPut: async (url, data) => {
      requested = url
      body = data
      return { status: 200, data: '[{"name":"Steve","level":4}]' }
    },
  })

  const content = await client.readFile('uuid-1', 'ops.json')

  assert.equal(requested, 'http://panel.local/api/files?remote_uuid=daemon-1&uuid=uuid-1&apikey=secret')
  assert.deepEqual(body, { target: 'ops.json' })
  assert.equal(content, '[{"name":"Steve","level":4}]')
}

async function testParsesOpsJsonFromInstanceFile() {
  const client = createMcsManagerClient({
    baseUrl: 'http://panel.local',
    remoteUuid: 'daemon-1',
    apiKey: 'secret',
    httpGet: async () => ({ status: 200, data: '' }),
    httpPut: async () => ({
      status: 200,
      data: JSON.stringify([
        { name: 'Steve', level: 4 },
        { name: 'Alex', level: 3 },
      ]),
    }),
  })

  const ops = await client.getOps('uuid-1')

  assert.deepEqual(ops, [
    { name: 'Steve', level: 4 },
    { name: 'Alex', level: 3 },
  ])
}

async function testParsesWhitelistFilesFromInstance() {
  const client = createMcsManagerClient({
    baseUrl: 'http://panel.local',
    remoteUuid: 'daemon-1',
    apiKey: 'secret',
    httpGet: async () => ({ status: 200, data: '' }),
    httpPut: async (_url, data) => {
      if ((data as any).target === 'whitelist.json') {
        return { status: 200, data: JSON.stringify([{ name: 'Steve' }]) }
      }
      return { status: 200, data: 'white-list=true\nenforce-whitelist=false\nmax-players=20\n' }
    },
  })

  const whitelist = await client.getWhitelist('uuid-1')

  assert.deepEqual(whitelist, {
    enabled: true,
    enforced: false,
    players: ['Steve'],
  })
}

async function testExtractsNewLogAfterCommand() {
  const client = createMcsManagerClient({
    baseUrl: 'http://panel.local',
    remoteUuid: 'daemon-1',
    apiKey: 'secret',
    httpGet: async () => ({
      status: 200,
      data: 'old\n> whitelist add Steve\n[02:49:10] [Server thread/INFO]: Added Steve to the whitelist\n>',
    }),
  })

  const log = await client.getNewLog('uuid-1', 'old', 'whitelist add Steve', 3)

  assert.equal(log, '[02:49:10] [Server thread/INFO]: Added Steve to the whitelist')
}

async function testExtractsNewLogAfterTailSnapshot() {
  const client = createMcsManagerClient({
    baseUrl: 'http://panel.local',
    remoteUuid: 'daemon-1',
    apiKey: 'secret',
    httpGet: async () => ({
      status: 200,
      data: 'startup line\nold tail line\n> whitelist add Steve\n[02:49:10] [Server thread/INFO]: Added Steve to the whitelist\n>',
    }),
  })

  const log = await client.getNewLog('uuid-1', 'old tail line', 'whitelist add Steve', 3)

  assert.equal(log, '[02:49:10] [Server thread/INFO]: Added Steve to the whitelist')
}

async function testExtractsNewLogStripsConsolePromptEscapes() {
  const client = createMcsManagerClient({
    baseUrl: 'http://panel.local',
    remoteUuid: 'daemon-1',
    apiKey: 'secret',
    httpGet: async () => ({
      status: 200,
      data: 'old tail line\n\u001b>\u001b=> \r[03:29:46] [Server thread/INFO] [minecraft/MinecraftServer]: There are 0 of a max of 20 players online: ',
    }),
  })

  const log = await client.getNewLog('uuid-1', 'old tail line', 'list', 3)

  assert.equal(log, '[03:29:46] [Server thread/INFO] [minecraft/MinecraftServer]: There are 0 of a max of 20 players online: ')
}

async function testGetNewLogDoesNotReturnFullLogWhenSnapshotMissing() {
  const client = createMcsManagerClient({
    baseUrl: 'http://panel.local',
    remoteUuid: 'daemon-1',
    apiKey: 'secret',
    httpGet: async () => ({
      status: 200,
      data: 'startup line\nold unrelated line\n[03:29:46] unrelated latest line',
    }),
  })

  const log = await client.getNewLog('uuid-1', 'old tail line that disappeared', 'say hello', 5)

  assert.equal(log, '')
}

async function testGetNewLogPrefersLatestLogFileAndKeepsCommandOutput() {
  const client = createMcsManagerClient({
    baseUrl: 'http://panel.local',
    remoteUuid: 'daemon-1',
    apiKey: 'secret',
    httpGet: async () => ({
      status: 200,
      data: '[MCSMANAGER] The instantaneous output content is too long and has been rejected.',
    }),
    httpPut: async (_url, data) => {
      assert.deepEqual(data, { target: 'logs/latest.log' })
      return { status: 200, data: 'old tail line\n[03:29:46] [Server thread/INFO] [minecraft/MinecraftServer]: [Server] hi' }
    },
  })

  const log = await client.getNewLog('uuid-1', 'old tail line', 'say hi', 5)

  assert.equal(log, '[03:29:46] [Server thread/INFO] [minecraft/MinecraftServer]: [Server] hi')
}

async function testGetInstanceUsesDetailEndpoint() {
  let requested = ''
  const client = createMcsManagerClient({
    baseUrl: 'http://panel.local',
    remoteUuid: 'daemon-1',
    apiKey: 'secret',
    httpGet: async (url) => {
      requested = url
      return {
        status: 200,
        data: {
          instanceUuid: 'uuid-1',
          status: 3,
          config: { nickname: 'Main', pingConfig: { ip: '', port: 25565 } },
          info: { version: '1.20.1', currentPlayers: 1, maxPlayers: 20 },
          processInfo: { cpu: 12.34, memory: 104857600, elapsed: 3600, pid: 1234 },
        },
      }
    },
  })

  const instance = await client.getInstance('uuid-1')

  assert.equal(requested, 'http://panel.local/api/instance?remote_uuid=daemon-1&uuid=uuid-1&apikey=secret')
  assert.deepEqual(instance, {
    uuid: 'uuid-1',
    name: 'Main',
    status: 3,
    version: '1.20.1',
    currentPlayers: 1,
    maxPlayers: 20,
    address: undefined,
    process: {
      cpu: 12.34,
      memory: 104857600,
      elapsed: 3600,
      pid: 1234,
    },
  })
}

async function testGetNodeStatusUsesRemoteServicesEndpoint() {
  let requested = ''
  const client = createMcsManagerClient({
    baseUrl: 'http://panel.local',
    remoteUuid: 'daemon-1',
    apiKey: 'secret',
    httpGet: async (url) => {
      requested = url
      return {
        status: 200,
        data: {
          remote: [
            {
              uuid: 'daemon-1',
              ip: 'localhost',
              port: 24444,
              available: true,
              version: '4.11.0',
              instance: { running: 1, total: 2 },
              system: { hostname: 'BREN9NP', cpuUsage: 0.023, memUsage: 0.665 },
            },
          ],
        },
      }
    },
  })

  const node = await client.getNodeStatus()

  assert.equal(requested, 'http://panel.local/api/overview?apikey=secret')
  assert.deepEqual(node, {
    available: true,
    address: 'localhost:24444',
    version: '4.11.0',
    hostname: 'BREN9NP',
    runningInstances: 1,
    totalInstances: 2,
    cpuUsage: 2.3,
    memoryUsage: 66.5,
  })
}

async function testControlInstanceUsesLifecycleEndpoint() {
  let requested = ''
  const client = createMcsManagerClient({
    baseUrl: 'http://panel.local',
    remoteUuid: 'daemon-1',
    apiKey: 'secret',
    httpGet: async (url) => {
      requested = url
      return { status: 200, time: 1710000000000, data: 'ok' }
    },
  })

  const result = await client.controlInstance('uuid-1', 'restart')

  assert.equal(requested, 'http://panel.local/api/protected_instance/restart?remote_uuid=daemon-1&uuid=uuid-1&apikey=secret')
  assert.equal(result.ok, true)
}

async function main() {
  await testListInstancesUsesMcsmanager9Endpoint()
  await testListInstancesFallsBackToMcsmanager10Endpoint()
  await testSendCommandEncodesMinecraftCommand()
  await testGetLogStripsAnsiAndReturnsTail()
  await testGetLogOmitsMcsmanagerLongOutputSentinel()
  await testGetLogPrefersLatestLogFileOverRejectedOutputlog()
  await testGetLogNormalizesMinecraftChineseTimestamp()
  await testReadsInstanceFileContent()
  await testParsesOpsJsonFromInstanceFile()
  await testParsesWhitelistFilesFromInstance()
  await testExtractsNewLogAfterCommand()
  await testExtractsNewLogAfterTailSnapshot()
  await testExtractsNewLogStripsConsolePromptEscapes()
  await testGetNewLogDoesNotReturnFullLogWhenSnapshotMissing()
  await testGetNewLogPrefersLatestLogFileAndKeepsCommandOutput()
  await testGetInstanceUsesDetailEndpoint()
  await testGetNodeStatusUsesRemoteServicesEndpoint()
  await testControlInstanceUsesLifecycleEndpoint()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
