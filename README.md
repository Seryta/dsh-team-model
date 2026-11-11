# dsh-team-model

[![license](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](LICENSE)

Agent Teams（`@deepseek-ai/dsh-experimental-agent-team-profile`）的**模型路由插件**：
Lead 永远跟随主对话，所有非 Lead teammate 共用一套可选的「提供商 / 模型 / 思考强度」配置。

## 安装

`lib/` 是随仓库提交的构建产物，git 依赖即可直接跑，不需要在本地重新构建：

```bash
# 方式一：装进 profile（推荐）
dsh plugin --profile web add github:Seryta/dsh-team-model

# 方式二：直接给运行中的实例注入（dsh-super-injector）
dev_inject_plugin {"dir": "/path/to/dsh-team-model"}
```

装好后打开 Web → 设置 → **Team 模型**。首次使用前需要先启用官方团队组合包：
`@deepseek-ai/dsh-experimental-agent-team-profile`（设置 → 插件 → 智能体团队）。

## 依赖与构建

- 运行时依赖由宿主提供：`@deepseek-ai/cordis`、`@deepseek-ai/schemastery`、`react`
- 构建：`npm run build:all`（host 用 checkout 里的 tsc，client 用 tsdown）

| 角色 | 模型来源 |
|---|---|
| Team Lead（主对话） | **始终跟随主对话**：Lead 就是主对话 agent 本身，路由由当前会话的模型选择决定，本插件从不改写它 |
| 所有非 Lead teammate | **默认继承 Lead（= 主对话）**；一旦在设置页配置了 provider/model，全部新建 teammate 共用这一套配置 |

## 设置

Web → 设置 → **Team 模型**（`settings.section` 槽位）：

- Lead（主对话）：只读说明，永远跟随当前会话模型
- Teammate **提供商 / 模型 / 思考强度** 三个下拉，和主对话模型选择器同源（`GET /team-model/api/catalog`，
  即 `llm.listProviders()` → `listModels()` → `resolveModelInfo()` 的 efforts）：
  - 提供商选「跟随主对话（不覆写）」= 不覆写，teammate 继承 Lead 路由
  - 模型：选定提供商后列出该提供商的全部模型；只有选了提供商没选模型时不能保存
  - 思考强度：「模型默认（不指定）」或该模型声明支持的档位（无 reasoning 元数据的模型只有「不指定」）
- 保存后立即对**之后新建**的 teammate 生效；已存在的 teammate 保持创建时的模型
- 「跟随主对话」按钮清空覆写，回到继承

配置落在 `$DSH_HOME/dsh-team-model.json`（`{}` = 跟随主对话）：

```json
{ "provider": "magpie", "model": "group/ds-flash", "reasoningEffort": "high", "maxTokens": 0 }
```

插件 `Config`（`cordis.patch.yml` 里的 `provider/model/reasoningEffort/maxTokens`）只作为**初始默认值**，文件优先。

## 实现

注入点：包一层 `ctx.subagents.startActivation`，只对**团队 spawn** 生效：

- 团队 spawn 的可判别特征：预留 `childId` + `delivery: 'parent'`（`subagent` 工具与 workflow 子代理都不预留 childId）
- 再用 `ctx.agentTeams.membership(parent).role === 'lead'` 二次确认
- 注入的 `agentOptions` 会被写进子会话的 subagent descriptor，冷恢复时同样生效
- 没有 `agentTeams`（未开团队模式）或没有覆写配置时，插件是纯透传

## HTTP API

```bash
curl -s localhost:3080/team-model/api/state           # 当前配置 + 可用 provider
curl -s "localhost:3080/team-model/api/models?provider=magpie"
curl -s -X POST localhost:3080/team-model/api/config \
  -H 'content-type: application/json' -d '{"provider":"magpie","model":"group/ds-flash"}'
```

端到端：配置后 `spawn_teammate`，`list_agents` 里该成员的 `model` 应等于配置值；清空配置后再建成员，应等于 Lead（主对话）的模型。

## 边界

- 只改 teammate 的**创建**路由：不会热切换已存在成员的模型；重建才有新模型
- 不改 Lead，也不改 `workflow` / `subagent_codex` 等非团队委派路径
- 构建：`bash scripts/build.sh`（host，tsc）+ `bash scripts/build-client.sh`（client，tsdown）
