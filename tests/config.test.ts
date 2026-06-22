import assert from 'node:assert/strict'
import { defaultConfig } from '../src/config'

function testDefaultConfigUsesWhitelistAndEmptyPermissions() {
  assert.deepEqual(defaultConfig, {
    baseUrl: '',
    remoteUuid: '',
    apiKey: '',
    permissionMode: 'whitelist',
    allowSandbox: true,
    permissions: [],
    logLines: 10,
  })
}

testDefaultConfigUsesWhitelistAndEmptyPermissions()
