import assert from 'node:assert/strict'
import { Config, apply, inject, name } from '../src/index'

function testPluginExportsKoishiMetadata() {
  assert.equal(name, 'miyako-mcsmanager')
  assert.deepEqual(inject, ['http'])
  assert.equal(typeof Config, 'function')
  assert.equal(typeof apply, 'function')
}

testPluginExportsKoishiMetadata()
