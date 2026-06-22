# koishi-plugin-miyako-mcsmanager

Miyako MCSManager 控制插件。它把常用 Minecraft 实例运维动作封装为 Koishi 指令，适合在可信群聊或私聊中查看实例状态、切换实例、读取日志、执行安全的 OP 与白名单管理。

## 功能

- `mc.list`：列出 MCSManager 实例，并显示可选择序号。
- `mc.use <序号>`：为当前会话选择一个实例。
- `mc.status` / `mca.s`：查看实例状态、进程资源与节点资源。
- `mc.log [行数]`：查看当前实例日志尾部。
- `mc.start` / `mc.stop` / `mc.restart`：发送实例生命周期控制指令。
- `mc.exec <命令>`：向 Minecraft 控制台发送原生命令。
- `mc.say <消息>`：以服务器身份广播消息。
- `mc.wl` / `mc.whitelist`：管理白名单，支持 `on`、`off`、`reload`、`ls`、`add`、`rm` 和 `mc wl 玩家名` 快捷添加。
- `mc.op`：管理 OP，支持 `ls`、`add`、`rm`。

OP 和白名单查询不会依赖控制台输出。插件会读取 `ops.json`、`whitelist.json` 和 `server.properties`，变更后也会轮询这些文件直到状态落盘，再返回最新列表。

## 配置

```yaml
plugins:
  miyako-mcsmanager:
    baseUrl: http://127.0.0.1:23333
    remoteUuid: your-daemon-uuid
    apiKey: your-api-key
    permissionMode: whitelist
    allowSandbox: true
    permissions:
      - platform: onebot
        type: group
        id: "123456789"
        allowedUsers: "10001,10002"
```

### 权限表

- `permissionMode: whitelist`：只有命中权限表的会话或用户可以使用指令。
- `permissionMode: blacklist`：命中权限表的会话或用户会被拒绝。
- `platform`：例如 `onebot`。
- `type`：`group`、`private` 或 `guild`。
- `id`：群号、私聊用户 ID 或频道 ID。
- `allowedUsers`：群聊/频道内允许或拒绝的用户 ID，多个值用逗号或空格分隔；留空表示整个目标。
- `allowSandbox`：默认开启，方便 Koishi 沙盒本地调试。

## 使用示例

```text
mc.list
mc.use 1
mc.status
mc log 30
mc op ls
mc op add Steve
mc wl on
mc wl add Steve
mc exec time set day
```

`mc op add Steve` 的回复示例：

```text
【实例】No Flesh Within Chest 0.3.2
【实际执行指令】op Steve
【最新OP 列表】AIzhang2025 (level 4)，miyakko_de (level 4)，Steve (level 4)
```

`mc wl add Steve` 的回复示例：

```text
【实例】No Flesh Within Chest 0.3.2
【实际执行指令】whitelist add Steve
【白名单】开启
【强制白名单】关闭
【最新白名单玩家】AIzhang2025, miyakko_de, Steve
```

## 开发

```bash
npm install
npm test
npm run build
npm run pack:check
```

项目结构：

- `src/`：Koishi 插件源码。
- `tests/`：测试文件，与源码分离。
- `lib/`：TypeScript 编译产物，不提交到仓库。
- `.github/workflows/ci.yml`：常规 CI，只测试、构建和 pack dry-run。
- `.github/workflows/publish.yml`：发布工作流模板，使用 npm trusted publishing / OIDC；实际 npm 发版由维护者触发。

## Publishing

GitHub Actions 已预留 npm trusted publishing/OIDC 所需的 `id-token: write` 权限。首次 npm 包创建、trusted publisher 绑定和实际发版请由维护者在 npm 侧完成。

## Acknowledgements

本插件是面向个人运维需求的 TypeScript 重写与工程化整理，灵感来自上游 `koishi-plugin-mcsmanager-custplugin@0.2.11`。感谢上游项目为 Koishi + MCSManager 场景提供的初始实现与使用思路。

## License

MIT
