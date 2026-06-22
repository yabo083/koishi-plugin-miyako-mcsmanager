import assert from 'node:assert/strict'
import { Config, apply, inject, name, toPermissionSession } from '../src/index'

function testPluginExportsKoishiMetadata() {
  assert.equal(name, 'miyako-mcsmanager')
  assert.deepEqual(inject, ['http'])
  assert.equal(typeof Config, 'function')
  assert.equal(typeof apply, 'function')
}

function testDirectOneBotSessionMapsToPrivatePermissionTarget() {
  const permissionSession = toPermissionSession({
    platform: 'onebot',
    isDirect: true,
    userId: '2058561180',
    channelId: 'private:2058561180',
  } as any)

  assert.deepEqual(permissionSession, {
    platform: 'onebot',
    type: 'private',
    targetId: '2058561180',
    userId: '2058561180',
  })
}

function testOneBotPrivateChannelMapsToPrivatePermissionTarget() {
  const permissionSession = toPermissionSession({
    platform: 'onebot',
    userId: '2058561180',
    channelId: 'private:2058561180',
  } as any)

  assert.deepEqual(permissionSession, {
    platform: 'onebot',
    type: 'private',
    targetId: '2058561180',
    userId: '2058561180',
  })
}

testPluginExportsKoishiMetadata()
testDirectOneBotSessionMapsToPrivatePermissionTarget()
testOneBotPrivateChannelMapsToPrivatePermissionTarget()
