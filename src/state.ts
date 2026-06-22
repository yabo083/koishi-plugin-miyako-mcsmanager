import type { McsInstance } from './api'

export interface NamespaceState {
  setInstances(sessionKey: string, instances: McsInstance[]): void
  selectInstance(sessionKey: string, index: number): McsInstance | undefined
  getActiveInstance(sessionKey: string): McsInstance | undefined
}

export function createNamespaceState(): NamespaceState {
  const lists = new Map<string, McsInstance[]>()
  const active = new Map<string, McsInstance>()

  return {
    setInstances(sessionKey, instances) {
      lists.set(sessionKey, instances)
      active.delete(sessionKey)
    },

    selectInstance(sessionKey, index) {
      const instance = lists.get(sessionKey)?.[index - 1]
      if (!instance) return undefined
      active.set(sessionKey, instance)
      return instance
    },

    getActiveInstance(sessionKey) {
      return active.get(sessionKey)
    },
  }
}
