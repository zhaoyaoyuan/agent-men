# Memory OS - Agent 记忆系统
[![Coverage](https://img.shields.io/badge/coverage-88%25-green.svg)](https://github.com/yourusername/agent-mem)

为 AI Agent 构建的持久化记忆系统。通过事件摄入、LLM 提取结构化记忆、相似度召回，为 AI 助手提供长期记忆能力。

## 特性

- **事件驱动** - 摄入任意类型的对话/行为事件
- **LLM 提取** - 自动从自然语言事件中提取结构化记忆
- **持久化存储** - 基于 SQLite，数据可靠持久
- **相似度召回** - 基于词重叠的快速相似度匹配，召回相关记忆
- **证据溯源** - 每个记忆都关联回原始事件，可追溯来源
- **双存储实现** - InMemory（测试/开发）和 SQLite（生产）
- **类型安全** - 100% TypeScript，完整类型定义
- **REST API** - 基于 Hono 的轻量级 HTTP API

## 记忆类型

系统支持 5 种核心记忆类型：

| 类型 | 说明 | 示例 |
|------|------|------|
| `fact` | 客观事实 | "项目使用 TypeScript 开发" |
| `constraint` | 约束条件 | "必须遵循 TDD 开发原则" |
| `preference` | 用户偏好 | "用户偏好深色模式界面" |
| `task_state` | 任务状态 | "登录功能已实现但未测试" |
| `experience` | 经验教训 | "之前用 Redis 导致内存泄漏" |

## 快速开始

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd agent-mem

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 Anthropic API 密钥
```

### 开发模式运行

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动

### 生产构建运行

```bash
npm run build
npm start
```

## API 使用示例

### 1. 摄入事件

将事件存入系统，准备提取记忆：

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj-1",
    "userId": "user-1",
    "event": {
      "eventType": "conversation",
      "sourceType": "chat",
      "scopeType": "project",
      "contentText": "用户偏好深色模式界面，工作时间是北京时间 9AM 到 5PM"
    }
  }'
```

响应：
```json
{
  "success": true,
  "data": {
    "eventId": "a1b2c3d4-...",
    "accepted": true,
    "deduplicated": false
  }
}
```

### 2. 从事件提取记忆

调用 LLM 从已摄入的事件中提取记忆：

```bash
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj-1",
    "userId": "user-1",
    "eventIds": ["a1b2c3d4-..."]
  }'
```

响应：
```json
{
  "success": true,
  "data": {
    "created": ["mem-1-...", "mem-2-..."],
    "updated": [],
    "skipped": []
  }
}
```

### 3. 召回相关记忆

根据查询文本召回相关记忆：

```bash
curl -X POST http://localhost:3000/api/recall \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj-1",
    "userId": "user-1",
    "query": "用户工作时间",
    "options": {
      "limit": 10
    }
  }'
```

响应：
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "memoryId": "mem-1-...",
        "memoryType": "preference",
        "title": "用户工作时间",
        "content": "用户工作时间是北京时间 9AM 到 5PM",
        "similarity": 0.65,
        "confidence": 0.9,
        "eventIds": ["a1b2c3d4-..."]
      }
    ],
    "packet": {
      "facts": [],
      "constraints": [],
      "preferences": [...],
      "taskStates": [],
      "experiences": []
    },
    "meta": {
      "totalFound": 2,
      "returned": 1,
      "query": "用户工作时间"
    }
  }
}
```

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `ANTHROPIC_API_KEY` | 是 | - | Anthropic API 密钥 |
| `ANTHROPIC_MODEL` | 否 | `claude-3-sonnet-20240229` | Claude 模型名称 |
| `PORT` | 否 | `3000` | HTTP 监听端口 |
| `MEMORY_OS_DB_PATH` | 否 | `./data/memory-os.sqlite` | SQLite 数据库路径 |

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (HTTP)                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Hono (API Router)                         │
│  - 路由分发                                                  │
│  - 输入验证                                                 │
│  - 错误处理                                                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                     Services                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ IngestEventService  - 摄入事件，去重存储                 ││
│  │ ExtractMemoriesService - 调用 LLM 提取结构化记忆         ││
│  │ RecallMemoriesService  - 相似度计算，排序召回           ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Repositories                              │
│  - ProjectRepository        项目管理                        │
│  - EventRepository          事件存储                        │
│  - MemoryRepository         记忆存储                        │
│  - EventMemoryLinkRepository 事件-记忆关联                  │
│                                                                 │
│  两种实现：InMemory / SQLite                                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                better-sqlite3 (SQLite)                       │
│              持久化存储所有事件和记忆                         │
└─────────────────────────────────────────────────────────────┘
```

## 数据表结构

| 表 | 说明 |
|---|------|
| `projects` | 项目信息，按项目隔离记忆空间 |
| `events` | 原始事件，保存完整上下文供溯源 |
| `memories` | 提取后的结构化记忆 |
| `event_memory_links` | 事件与记忆的多对多关联 |

## 开发

### 运行测试

```bash
# 运行所有测试
npm test

# 覆盖率报告
npm run test:coverage

# 类型检查
npm run typecheck

# 代码格式化
npm run lint
```

### 测试覆盖率

当前测试覆盖率：**88%+**

```
-------------------|---------|----------|---------|---------|
File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
All files          |   88.12 |    81.25 |   92.31 |   87.50 |
 config            |   100   |    100   |   100   |   100   |
 repositories      |   89.3  |    82.1  |   93.8  |   88.7  |
 services          |   86.7  |    78.9  |   91.2  |   85.1  |
 api               |   85.2  |    76.5  |   88.9  |   84.6  |
-------------------|---------|----------|---------|---------|
```

### 依赖注入设计

所有组件都依赖抽象接口而非具体实现，易于测试和替换：

```typescript
// 接口定义
export interface MemoryRepository {
  insert(record: MemoryRecordLike): Promise<void>
  findById(id: string): Promise<MemoryRecord | null>
  findByProjectId(projectId: string): Promise<MemoryRecord[]>
  // ...
}

// 两种实现
export class InMemoryMemoryRepository implements MemoryRepository { ... }
export class SQLiteMemoryRepository implements MemoryRepository { ... }

// 服务依赖注入
export function createExtractMemoriesService(deps: {
  projectRepository: ProjectRepository
  memoryRepository: MemoryRepository
  llmClient: LLMClient
}) {
  // ...
}
```

## 使用场景

- **AI 助手长期记忆** - 记住用户偏好、历史对话、决策
- **开发助手上下文** - 记住项目结构、技术决策、教训
- **对话代理知识库** - 从历史对话中持续学习

## Claude Code 技能集成

Memory OS 提供了两个 Claude Code 技能，可以直接在 Claude Code 中使用：

### `/memory-os-recall` - 召回相关记忆

在 Claude Code 中开始任何新任务之前，使用这个技能从 Memory OS 召回当前项目的相关记忆：

```
/memory-os-recall query=实现用户登录功能
```

**工作流程：**
1. 自动检测当前项目（使用 git 根目录名称作为 projectId）
2. 调用 Memory OS API 召回相关记忆
3. 展示召回结果，并指导你根据记忆工作

**规则：**
- 尊重已有决策，严格遵守项目中的技术决策和架构选择
- 遵从用户偏好
- 避免重复踩坑，经验教训中提到的问题不再重复
- 复用已有的知识和代码结构
- 保持项目一致性

### `/memory-os-ingest` - 摄入新记忆

任务完成后，使用这个技能将重要决策、结论、结果摄入到 Memory OS：

```
/memory-os-ingest content=成功实现了用户登录功能，使用 JWT 认证，数据库表结构在 src/db/schema/users.ts
```

**工作流程：**
1. 自动检测当前项目
2. 将内容作为 `decision` 事件摄入
3. 提示你复制 `eventId` 进行记忆提取
4. 提取完成后，记忆永久保存

## 使用场景

- **AI 助手长期记忆** - 记住用户偏好、历史对话、决策
- **开发助手上下文** - 记住项目结构、技术决策、教训
- **对话代理知识库** - 从历史对话中持续学习

## 许可证

MIT
