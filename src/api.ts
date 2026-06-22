export interface McsManagerClientOptions {
  baseUrl: string
  remoteUuid: string
  apiKey: string
  httpGet: (url: string, options?: { headers?: Record<string, string> }) => Promise<any>
  httpPut?: (url: string, data: unknown, options?: { headers?: Record<string, string> }) => Promise<any>
}

export interface McsInstance {
  uuid: string
  name: string
  status: number
  version?: string
  currentPlayers?: number
  maxPlayers?: number
  onlinePlayers?: string[]
  address?: string
  process?: McsProcessInfo
}

export interface McsProcessInfo {
  cpu?: number
  memory?: number
  elapsed?: number
  pid?: number
}

export interface McsNodeStatus {
  available: boolean
  address?: string
  version?: string
  hostname?: string
  runningInstances?: number
  totalInstances?: number
  cpuUsage?: number
  memoryUsage?: number
}

export interface McsActionResult {
  ok: boolean
  time?: number
  message?: string
}

export interface McsOperator {
  name: string
  level: number
}

export interface McsWhitelist {
  enabled: boolean
  enforced: boolean
  players: string[]
}

export interface McsManagerClient {
  listInstances(): Promise<McsInstance[]>
  getInstance(uuid: string): Promise<McsInstance>
  getNodeStatus(): Promise<McsNodeStatus | undefined>
  controlInstance(uuid: string, action: 'start' | 'stop' | 'restart'): Promise<McsActionResult>
  sendCommand(uuid: string, command: string): Promise<McsActionResult>
  getLog(uuid: string, lines: number): Promise<string>
  getNewLog(uuid: string, before: string, command: string, lines: number): Promise<string>
  readFile(uuid: string, target: string): Promise<string>
  getOps(uuid: string): Promise<McsOperator[]>
  getWhitelist(uuid: string): Promise<McsWhitelist>
}

export function createMcsManagerClient(options: McsManagerClientOptions): McsManagerClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, '')

  function commonQuery(uuid?: string) {
    const params = [
      `remote_uuid=${encodeURIComponent(options.remoteUuid)}`,
      uuid ? `uuid=${encodeURIComponent(uuid)}` : undefined,
      `apikey=${encodeURIComponent(options.apiKey)}`,
    ].filter(Boolean)
    return params.join('&')
  }

  return {
    async listInstances() {
      const url = `${baseUrl}/api/service/remote_service_instances?page=1&page_size=100&status=&instance_name=&${commonQuery()}`
      let response = await options.httpGet(url)
      if (response?.data?.maxPage && response.data.maxPage !== 1) {
        const fallbackUrl = `${baseUrl}/api/service/remote_service_instances?page=1&page_size=100&status=&instance_name=&daemonId=${encodeURIComponent(options.remoteUuid)}&token=${encodeURIComponent(options.apiKey)}`
        response = await options.httpGet(fallbackUrl, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      }
      const list = response?.data?.data ?? []
      return list.map(normalizeInstance)
    },

    async getInstance(uuid) {
      const url = `${baseUrl}/api/instance?${commonQuery(uuid)}`
      const response = await options.httpGet(url)
      return normalizeInstance(response?.data)
    },

    async getNodeStatus() {
      const url = `${baseUrl}/api/overview?apikey=${encodeURIComponent(options.apiKey)}`
      const response = await options.httpGet(url)
      const node = response?.data?.remote?.find((item: any) => item.uuid === options.remoteUuid)
      if (!node) return undefined
      return {
        available: Boolean(node.available),
        address: node.ip ? `${node.ip}:${node.port}` : undefined,
        version: node.version,
        hostname: node.system?.hostname,
        runningInstances: node.instance?.running,
        totalInstances: node.instance?.total,
        cpuUsage: node.system?.cpuUsage === undefined ? undefined : node.system.cpuUsage * 100,
        memoryUsage: node.system?.memUsage === undefined ? undefined : node.system.memUsage * 100,
      }
    },

    async controlInstance(uuid, action) {
      const path = action === 'start' ? 'open' : action
      const url = `${baseUrl}/api/protected_instance/${path}?${commonQuery(uuid)}`
      const response = await options.httpGet(url)
      return {
        ok: response?.status === 200,
        time: response?.time,
        message: response?.data,
      }
    },

    async sendCommand(uuid, command) {
      const url = `${baseUrl}/api/protected_instance/command?${commonQuery(uuid)}&command=${encodeURIComponent(command)}`
      const response = await options.httpGet(url)
      return {
        ok: response?.status === 200,
        time: response?.time,
        message: response?.data,
      }
    },

    async getLog(uuid, lines) {
      return tailLines(await readLog(uuid), lines)
    },

    async getNewLog(uuid, before, command, lines) {
      const current = await readLog(uuid)
      const beforeIndex = before ? current.lastIndexOf(before) : -1
      if (before && beforeIndex < 0) return ''
      const next = beforeIndex >= 0 ? current.slice(beforeIndex + before.length) : current
      return tailLines(next.split('\n').filter((line) => {
        const trimmed = line.trim()
        return trimmed && trimmed !== `> ${command}` && trimmed !== command
      }).join('\n'), lines)
    },

    async readFile(uuid, target) {
      const url = `${baseUrl}/api/files?${commonQuery(uuid)}`
      const response = await options.httpPut!(url, { target })
      return response?.status === 200 ? String(response.data ?? '') : ''
    },

    async getOps(uuid) {
      const content = await this.readFile(uuid, 'ops.json')
      return JSON.parse(content || '[]').map((item: any) => ({
        name: item.name,
        level: item.level,
      }))
    },

    async getWhitelist(uuid) {
      const players = JSON.parse(await this.readFile(uuid, 'whitelist.json') || '[]').map((item: any) => item.name)
      const props = await this.readFile(uuid, 'server.properties')
      return {
        enabled: /^white-list=true$/m.test(props),
        enforced: /^enforce-whitelist=true$/m.test(props),
        players,
      }
    },
  }

  async function readLog(uuid: string) {
    if (options.httpPut) {
      const fileContent = await readFileContent(uuid, 'logs/latest.log')
      if (fileContent) return cleanLogLines(stripAnsi(fileContent))
    }
    const url = `${baseUrl}/api/protected_instance/outputlog?${commonQuery(uuid)}`
    const response = await options.httpGet(url)
    if (response?.status !== 200) return ''
    return cleanLogLines(stripAnsi(String(response.data ?? '')))
  }

  async function readFileContent(uuid: string, target: string) {
    const url = `${baseUrl}/api/files?${commonQuery(uuid)}`
    const response = await options.httpPut!(url, { target })
    return response?.status === 200 ? String(response.data ?? '') : ''
  }
}

function normalizeInstance(input: any): McsInstance {
  const ip = input?.config?.pingConfig?.ip
  const port = input?.config?.pingConfig?.port
  const instance: McsInstance = {
    uuid: input?.instanceUuid,
    name: input?.config?.nickname,
    status: input?.status,
    version: input?.info?.version,
    currentPlayers: input?.info?.currentPlayers,
    maxPlayers: input?.info?.maxPlayers,
    address: ip ? `${ip}:${port}` : undefined,
  }
  if (input?.processInfo) {
    instance.process = {
      cpu: input.processInfo.cpu,
      memory: input.processInfo.memory,
      elapsed: input.processInfo.elapsed,
      pid: input.processInfo.pid,
    }
  }
  return instance
}

function stripAnsi(value: string) {
  return value
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x1B[=>]/g, '')
    .split('\n')
    .map((line) => line.slice(line.lastIndexOf('\r') + 1))
    .join('\n')
}

function cleanLogLines(value: string) {
  return value.split('\n').filter((line) => {
    const trimmed = line.trim()
    return trimmed && trimmed !== '>' && !trimmed.includes('instantaneous output content is too long')
  }).map(normalizeLogTimestamp).join('\n')
}

function normalizeLogTimestamp(line: string) {
  return line.replace(/^\[(\d{2})(\d{1,2})月(\d{4}) (\d{2}:\d{2}:\d{2}\.\d{3})\]/, (_match, day: string, month: string, year: string, time: string) => {
    return `[${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${time}]`
  })
}

function tailLines(value: string, lines: number) {
  if (!value) return ''
  return value.split('\n').slice(-lines).join('\n')
}
