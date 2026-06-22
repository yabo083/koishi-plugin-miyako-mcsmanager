import assert from 'node:assert/strict'
import { canUseCommand } from '../src/permissions'

function testWhitelistAllowsWholeGroupWhenAllowedUsersEmpty() {
  const allowed = canUseCommand(
    {
      platform: 'onebot',
      type: 'group',
      targetId: '123',
      userId: '456',
    },
    {
      mode: 'whitelist',
      entries: [
        { platform: 'onebot', type: 'group', id: '123', allowedUsers: '' },
      ],
    },
  )

  assert.equal(allowed, true)
}

function testWhitelistRestrictsGroupToAllowedUsers() {
  const allowed = canUseCommand(
    {
      platform: 'onebot',
      type: 'group',
      targetId: '123',
      userId: '999',
    },
    {
      mode: 'whitelist',
      entries: [
        { platform: 'onebot', type: 'group', id: '123', allowedUsers: '456' },
      ],
    },
  )

  assert.equal(allowed, false)
}

function testWhitelistPrivateUsesTargetUserId() {
  const allowed = canUseCommand(
    {
      platform: 'onebot',
      type: 'private',
      targetId: '456',
      userId: '456',
    },
    {
      mode: 'whitelist',
      entries: [
        { platform: 'onebot', type: 'private', id: '456', allowedUsers: 'ignored' },
      ],
    },
  )

  assert.equal(allowed, true)
}

function testBlacklistDeniesMatchingGroupUserButAllowsOthers() {
  const denied = canUseCommand(
    {
      platform: 'onebot',
      type: 'group',
      targetId: '123',
      userId: '456',
    },
    {
      mode: 'blacklist',
      entries: [
        { platform: 'onebot', type: 'group', id: '123', allowedUsers: '456' },
      ],
    },
  )
  const allowed = canUseCommand(
    {
      platform: 'onebot',
      type: 'group',
      targetId: '123',
      userId: '789',
    },
    {
      mode: 'blacklist',
      entries: [
        { platform: 'onebot', type: 'group', id: '123', allowedUsers: '456' },
      ],
    },
  )

  assert.equal(denied, false)
  assert.equal(allowed, true)
}

function testGroupAllowedUsersUsesExactTokens() {
  const allowed = canUseCommand(
    {
      platform: 'onebot',
      type: 'group',
      targetId: '123',
      userId: '456',
    },
    {
      mode: 'whitelist',
      entries: [
        { platform: 'onebot', type: 'group', id: '123', allowedUsers: '1456,789' },
      ],
    },
  )

  assert.equal(allowed, false)
}

function testSandboxCanBypassPermissionTable() {
  const allowed = canUseCommand(
    {
      platform: 'sandbox',
      type: 'private',
      targetId: 'Alice',
      userId: 'Alice',
    },
    {
      mode: 'whitelist',
      allowSandbox: true,
      entries: [],
    },
  )

  assert.equal(allowed, true)
}

function testLegacyConfigAllowsSandboxByDefault() {
  const allowed = canUseCommand(
    {
      platform: 'sandbox',
      type: 'private',
      targetId: 'Alice',
      userId: 'Alice',
    },
    {
      mode: 'whitelist',
      entries: [],
    },
  )

  assert.equal(allowed, true)
}

function testSandboxPrefixedPlatformBypassesPermissionTable() {
  const allowed = canUseCommand(
    {
      platform: 'sandbox:koishi',
      type: 'group',
      targetId: '#',
      userId: 'Alice',
    },
    {
      mode: 'whitelist',
      entries: [],
    },
  )

  assert.equal(allowed, true)
}

function testLegacyEntryUsesSchemaDefaults() {
  const allowed = canUseCommand(
    {
      platform: 'onebot',
      type: 'private',
      targetId: '1111',
      userId: '1111',
    },
    {
      entries: [
        { type: 'private', id: '1111' },
      ],
    } as any,
  )

  assert.equal(allowed, true)
}

function testConsoleTableNumericPrivateIdMatchesSessionId() {
  const allowed = canUseCommand(
    {
      platform: 'onebot',
      type: 'private',
      targetId: '2058561180',
      userId: '2058561180',
    },
    {
      mode: 'whitelist',
      entries: [
        { platform: 'onebot', type: 'private', id: 2058561180, allowedUsers: '' } as any,
      ],
    },
  )

  assert.equal(allowed, true)
}

function testConsoleTableNumericAllowedUsersMatchSessionUser() {
  const allowed = canUseCommand(
    {
      platform: 'onebot',
      type: 'group',
      targetId: '123456789',
      userId: '2058561180',
    },
    {
      mode: 'whitelist',
      entries: [
        { platform: 'onebot', type: 'group', id: 123456789, allowedUsers: 2058561180 } as any,
      ],
    },
  )

  assert.equal(allowed, true)
}

function main() {
  testWhitelistAllowsWholeGroupWhenAllowedUsersEmpty()
  testWhitelistRestrictsGroupToAllowedUsers()
  testWhitelistPrivateUsesTargetUserId()
  testBlacklistDeniesMatchingGroupUserButAllowsOthers()
  testGroupAllowedUsersUsesExactTokens()
  testSandboxCanBypassPermissionTable()
  testLegacyConfigAllowsSandboxByDefault()
  testSandboxPrefixedPlatformBypassesPermissionTable()
  testLegacyEntryUsesSchemaDefaults()
  testConsoleTableNumericPrivateIdMatchesSessionId()
  testConsoleTableNumericAllowedUsersMatchSessionUser()
}

main()
