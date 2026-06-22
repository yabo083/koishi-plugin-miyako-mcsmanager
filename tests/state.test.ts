import assert from 'node:assert/strict'
import { createNamespaceState } from '../src/state'

function testSelectsOneBasedIndexFromSessionList() {
  const state = createNamespaceState()
  state.setInstances('onebot:group:1000', [
    { uuid: 'uuid-a', name: 'Alpha', status: 0 },
    { uuid: 'uuid-b', name: 'Beta', status: 3 },
  ])

  const selected = state.selectInstance('onebot:group:1000', 2)

  assert.deepEqual(selected, { uuid: 'uuid-b', name: 'Beta', status: 3 })
  assert.deepEqual(state.getActiveInstance('onebot:group:1000'), selected)
}

function testKeepsSessionsIsolated() {
  const state = createNamespaceState()
  state.setInstances('onebot:group:1000', [{ uuid: 'uuid-a', name: 'Alpha', status: 3 }])
  state.setInstances('onebot:private:2000', [{ uuid: 'uuid-b', name: 'Beta', status: 3 }])

  state.selectInstance('onebot:group:1000', 1)
  state.selectInstance('onebot:private:2000', 1)

  assert.equal(state.getActiveInstance('onebot:group:1000')?.uuid, 'uuid-a')
  assert.equal(state.getActiveInstance('onebot:private:2000')?.uuid, 'uuid-b')
}

function testReturnsUndefinedForInvalidSelection() {
  const state = createNamespaceState()
  state.setInstances('onebot:group:1000', [{ uuid: 'uuid-a', name: 'Alpha', status: 3 }])

  const selected = state.selectInstance('onebot:group:1000', 2)

  assert.equal(selected, undefined)
  assert.equal(state.getActiveInstance('onebot:group:1000'), undefined)
}

function main() {
  testSelectsOneBasedIndexFromSessionList()
  testKeepsSessionsIsolated()
  testReturnsUndefinedForInvalidSelection()
}

main()
