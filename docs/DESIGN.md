# Memory OS 设计理念与架构

## 设计理念

### 核心思想

Memory OS 是一个为 AI Agent 设计的**持久化记忆系统**。其核心设计哲学是：

> **让 AI Agent 记住过去的经验，在未来做出更好的决策**

通过「事件摄入 → LLM 提取记忆 → 相似度召回」三阶段工作流，为 AI 助手提供长期记忆能力。

### 设计原则

1. **事件驱动** - 一切从事件开始，原始事件完整保存，可追溯可重提
2. **分离存储** - 原始事件和提取记忆分开存储，记忆是结构化知识，事件是原始证据
3. **类型化记忆** - 不同类型的记忆有不同的语义，召回时可分类过滤
4. **证据溯源** - 每个记忆都能追溯回产生它的原始事件
5. **依赖注入** - 所有组件依赖接口，易于测试和替换存储后端
6. **单一职责** - 每个模块只做一件事，保持代码简洁

## 系统架构

### 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                     HTTP Client                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Hono (API Router)                         │
│  • 路由分发                                                  │
│  • 输入验证                                                 │
│  • 统一错误处理                                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                     Services                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ IngestEventService    - 摄入事件，验证存储               ││
│  │ ExtractMemoriesService - 调用 LLM 提取结构化记忆         ││
│  │ RecallMemoriesService  - 相似度计算，排序召回           ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Repositories                              │
│  • ProjectRepository        项目（隔离空间）                │
│  • EventRepository          原始事件存储                    │
│  • MemoryRepository         结构化记忆存储                  │
│  • EventMemoryLinkRepository 事件 ↔ 记忆多对多关联         │
│  │                                                                 │
│  • 双重实现：InMemory（测试/开发） / SQLite（生产）          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              better-sqlite3 (SQLite Engine)                 │
│              持久化存储所有事件和记忆                         │
└─────────────────────────────────────────────────────────────┘
```

### 数据流

```
用户/Agent
  ↓
[摄入] POST /api/ingest
  ↓
IngestEventService
  ↓
EventRepository
  ↓
返回 eventId
  ↓
[提取] POST /api/extract
  ↓
ExtractMemoriesService
  ↓
LLM 提取 → MemoryRepository → EventMemoryLinkRepository
  ↓
返回 created[] memoryIds
  ↓
[召回] POST /api/recall
  ↓
RecallMemoriesService
  ↓
基于 token 重叠计算相似度 → 排序 → 按类型分组
  ↓
返回 召回结果
```

## 核心概念

### 记忆类型

系统定义了 5 种核心记忆类型：

| 类型 | 说明 | 示例 |
|------|------|------|
| `fact` | 客观事实 | 项目使用 TypeScript 开发 |
| `constraint` | 约束条件 | 必须遵循 TDD 开发原则 |
| `preference` | 用户偏好 | 用户偏好深色模式界面 |
| `task_state` | 任务状态 | 登录功能已实现但未测试 |
| `experience` | 经验教训 | 之前用 Redis 导致内存泄漏 |

### 事件类型

支持的事件类型覆盖 AI Agent 全生命周期：

| 类型 | 说明 |
|------|------|
| `message` | 用户/助手消息 |
| `tool_call` | 工具调用 |
| `tool_result` | 工具返回结果 |
| `decision` | 决策记录 |
| `error` | 错误记录 |
| `feedback` | 用户反馈 |
| `system` | 系统信息 |

### 数据源类型

记录事件来源：

| 类型 | 说明 |
|------|------|
| `claude` | Claude Code / Claude API |
| `cursor` | Cursor 编辑器 |
| `sdk` | SDK 调用 |
| `cli` | 命令行 |
| `mcp` | Model Context Protocol |
| `system` | 系统生成 |
| `external` | 外部输入 |

### 作用域

支持不同层级的记忆隔离：

| 类型 | 说明 |
|------|------|
| `project` | 项目级别 |
| `session` | 会话级别 |
| `conversation` | 对话级别 |
| `message` | 单条消息 |

## 数据库架构

### 表结构

| 表 | 说明 |
|----|------|
| `projects` | 项目信息，按项目隔离记忆空间 |
| `events` | 原始事件，保存完整上下文供溯源 |
| `memories` | 提取后的结构化记忆 |
| `event_memory_links` | 事件与记忆的多对多关联 |

### 关系

```
projects 1 ──┐ N events
           ├─ N memories
events   N ──┐ N event_memory_links
memories  N ──┘ N event_memory_links
```

每个记忆都通过 `event_memory_links` 关联回原始事件，保证可溯源。

## 模块职责

### `src/config/`

环境配置读取，使用 `dotenv` 加载，提供类型安全的配置对象。

### `src/clients/`

外部服务客户端，当前: `anthropic-llm-client.ts` 封装 Claude API 用于记忆提取。支持自定义 `baseURL` 兼容火山方舟等代理服务。

### `src/db/`

- `client/sqlite.ts` - SQLite 客户端初始化，动态生成建表 DDL
- `schema/` - 每张表的结构定义，包含列名和类型约束

### `src/domain/`

领域类型定义和验证契约。

### `src/repositories/`

数据访问层，定义接口并提供两种实现：

- `*Repository` - 接口定义
- `InMemory*Repository` - 内存实现，用于测试
- `SQLite*Repository` - SQLite 持久化实现，生产使用

### `src/services/`

业务逻辑层：

- `ingest-event-service` - 摄入事件，验证输入，存储
- `extract-memories-service` - 调用 LLM 从事件内容提取结构化记忆
- `recall-memories-service` - 基于 token 重叠相似度计算，召回相关记忆

### `src/services/validators/`

输入验证，确保 API 输入符合格式要求。

### `src/api/`

HTTP API 路由定义，基于 Hono 框架。

### `src/shared/`

共享类型和工具：

- `errors` - 自定义错误类
- `result` - API 响应格式
- `types` - 共享类型定义

## 设计决策

### 为什么使用 SQLite？

1. **单节点部署简单** - 不需要额外数据库服务
2. **事务支持** - 保证数据一致性
3. **成熟稳定** - 生态完善，better-sqlite3 驱动性能优秀
4. **文件级存储** - 易于备份和迁移
5. **适合场景** - 每个用户/项目一个数据库文件，隔离性好

### 为什么使用相似度召回而不是向量？

1. **简单有效** - 对于关键词匹配，token 重叠已经足够好
2. **没有依赖** - 不需要额外向量数据库或嵌入模型
3. **低延迟** - 计算快，不需要网络调用
4. **迭代空间** - 未来可以升级为向量召回，但当前方案够用

当前使用基于词频重叠的 Jaccard 相似度：

```typescript
similarity = 重叠词数 / 总词数
```

### 为什么事件和分开存储？

- **事件** - 原始数据，可能很大，不常访问
- **记忆** - 结构化提取，小而精，频繁召回
- 分离存储可以提高召回性能，同时保留原始数据用于溯源

### 为什么依赖注入接口？

- 易于测试 - 测试时可以 mock 存储层
- 易于替换 - 未来可以支持 PostgreSQL 等其他存储
- 符合依赖倒置原则 - 依赖抽象不依赖具体实现

## API 设计

### 端点

| 方法 | 端点 | 功能 |
|------|------|------|
| `POST` | `/api/ingest` | 摄入事件 |
| `POST` | `/api/extract` | 提取记忆 |
| `POST` | `/api/recall` | 召回记忆 |

### 响应格式

所有响应遵循统一格式：

```typescript
// 成功
{
  "success": true,
  "data": { ... }
}

// 失败
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "project not found",
    "retryable": false
  }
}
```

### 错误码

| 码 | 说明 |
|----|------|
| `INVALID_INPUT` | 输入验证失败 |
| `NOT_FOUND` | 资源不存在 |
| `CONFLICT` | 资源冲突 |
| `STORAGE_ERROR` | 存储操作失败 |
| `LLM_ERROR` | LLM 调用失败 |
| `RECALL_ERROR` | 召回失败 |
| `INTERNAL_ERROR` | 其他错误 |

## 后续发展方向

### 短期改进

- [ ] **向量召回** - 集成 OpenAI/text-embedding，支持语义相似度召回
- [ ] **实体提取** - 从事件中提取实体（技术概念、项目名称、人物...），建立实体-记忆关联
- [ ] **记忆衰减** - 根据时间衰减记忆分数，新鲜度权重
- [ ] **记忆强化** - 被召回越多的记忆，强度越高，排名越靠前
- [ ] **合并相似记忆** - LLM 自动合并相似记忆，减少冗余

### 中期功能

- [ ] **记忆对话** - 支持基于记忆的问答，让 AI 直接使用记忆回答问题
- [ ] **自动摄入** - Claude Code 技能自动摄入每次会话的决策和结论
- [ ] **MCP 服务器** - 暴露为 Model Context Protocol 服务器，供其他 AI 客户端使用
- [ ] **全文搜索** - 集成全文搜索引擎（如 SQLite FTS）
- [ ] **标签系统** - 支持自定义标签，过滤查询

### 长期演进

- [ ] **记忆图** - 构建记忆之间的关联图，支持联想召回
- [ ] **多层级记忆压缩** - 自动将多个小记忆压缩为更大的抽象记忆
- [ ] **遗忘机制** - 自动遗忘低质量、过期的记忆
- [ ] **多用户协作** - 支持项目级共享记忆
- [ ] **权限控制** - 项目级读写权限

### 生态集成

- [ ] **Obsidian 插件** - 同步 Obsidian 笔记到 Memory OS
- [ ] **VSCode 扩展** - 记住项目开发中的决策和教训
- [ ] **CLI 工具** - 命令行直接摄入和召回

## 已解决的问题

### 启动配置问题

| 问题 | 解决方案 |
|------|----------|
| 火山方舟需要自定义 baseURL | `src/config/env.ts` 添加 `anthropicBaseUrl` 配置，`AnthropicLLMClient` 支持传入 |
| 原来 `create*DDL` 函数不存在 | 改为从 table 定义动态生成 DDL |
| 多个连接冲突 | 所有仓储共享同一个 db 连接 |
| 索引 SQL 语法错误 | 正确解析索引定义生成 SQL |
| 端口占用 | 杀掉旧进程重新启动 |

## 技术栈

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Hono
- **Database**: SQLite + better-sqlite3
- **LLM**: Anthropic Claude (支持自定义 baseURL)
- **Testing**: Vitest
- **Runner**: tsx (开发)

## 快速参考

### 项目创建

```typescript
// 项目必须先创建才能摄入事件
// 可以使用脚本创建
import { SQLiteProjectRepository } from './repositories/sqlite-project-repository'
await repo.insert({
  id: 'my-project',
  slug: 'my-project',
  name: 'My Project',
  owner_user_id: 'me',
})
```

### 摄入事件

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "my-project",
    "userId": "me",
    "event": {
      "eventType": "decision",
      "sourceType": "claude",
      "scope": { "type": "project" },
      "contentText": "决定使用 SQLite 作为存储后端"
    }
  }'
```

### 提取记忆

```bash
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "my-project",
    "userId": "me",
    "eventIds": ["<event-id>"]
  }'
```

### 召回记忆

```bash
curl -X POST http://localhost:3000/api/recall \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "my-project",
    "userId": "me",
    "query": "存储后端选择",
    "options": { "limit": 5 }
  }'
```
