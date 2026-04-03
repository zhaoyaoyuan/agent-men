# Memory OS API 契约文档

- **文档类型**：实现级 API 契约设计
- **状态**：Draft
- **目标读者**：协作开发者、服务层实现者、Adapter 开发者
- **依赖文档**：`docs/architecture.md`、`docs/schema.md`
- **最后更新**：2026-03-27

---

## 1. 文档目标

本文档将 `docs/architecture.md` 中的 API 契约章节进一步细化为可实现的接口设计，用于指导：

- service 层接口定义
- SDK / CLI / skill / MCP adapter 映射
- 输入校验与错误处理
- 幂等性与一致性控制
- 集成测试编写

本文档关注的是 **领域级 API 契约**，而不是 HTTP 路由设计。也就是说，不论未来接入形式是函数调用、CLI 子命令、MCP tool 还是 HTTP endpoint，核心输入输出语义都保持一致。

---

## 2. 设计原则

### 2.1 Command / Query 分离

V1 API 分为两类：

#### Command

会修改系统状态：

- `ingestEvent`
- `extractMemories`
- `consolidateDocument`
- `submitFeedback`

#### Query

只读取系统状态：

- `recallMemories`
- `traceMemory`

这样可以让不同接入层在不改变核心语义的前提下自由映射。

### 2.2 领域对象优先于传输协议

接口的 first-class object 是：

- Event
- Memory
- Document
- Feedback
- MemoryPacket

而不是某一种具体协议格式。

### 2.3 输入必须显式作用域化

所有涉及业务数据的接口都必须显式带上：

- `projectId`
- `userId`
- 必要时 `scope`

避免依赖隐式上下文，降低跨客户端行为不一致。

### 2.4 可解释性不是附加能力

Recall 和 trace 相关接口必须天然支持：

- 排名原因
- 证据链路
- 关联文档
- 可裁剪返回

### 2.5 错误必须结构化

所有接口统一返回结构化错误，而不是字符串异常直出。

### 2.6 配置优先于分叉接口

像 explainability、evidence、documents 这类差异，不新增多套接口，而是通过 `options` 控制。

---

## 3. 接口总览

## 3.1 核心接口清单

| 接口 | 类型 | 作用 |
|---|---|---|
| `ingestEvent` | Command | 写入原始事件 |
| `extractMemories` | Command | 从事件提炼记忆 |
| `recallMemories` | Query | 根据上下文召回记忆包 |
| `submitFeedback` | Command | 提交反馈并驱动强化/衰减 |
| `consolidateDocument` | Command | 将稳定记忆沉淀为文档 |
| `traceMemory` | Query | 追踪记忆来源、关联文档与链接关系 |

## 3.2 推荐调用链

典型调用顺序为：

```text
recallMemories
  -> 执行任务
  -> ingestEvent
  -> extractMemories
  -> submitFeedback
  -> consolidateDocument
```

并不是所有调用都必须每轮执行，但该链路构成 V1 的最小闭环。

---

## 4. 统一类型约定

## 4.1 基础别名

```ts
export type ID = string
export type ISODateTime = string

export type ProjectId = ID
export type UserId = ID
export type AgentId = ID
export type EventId = ID
export type MemoryId = ID
export type DocumentId = ID
export type EntityId = ID
export type FeedbackId = ID
```

## 4.2 作用域类型

```ts
export type ScopeType = 'global' | 'user' | 'project' | 'user_project' | 'custom'

export interface ScopeRef {
  type: ScopeType
  userId?: UserId
  projectId?: ProjectId
  key?: string
}
```

说明：

- `projectId` 依然是接口顶层必填字段之一
- `scope` 用于描述 recall / memory 的逻辑适用范围
- `custom` 只在明确场景下使用，避免滥用字符串 scope

## 4.3 统一响应格式

```ts
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
}

export interface ApiError {
  code: ApiErrorCode
  message: string
  details?: Record<string, unknown>
  retryable?: boolean
}

export type ApiErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNSUPPORTED_OPERATION'
  | 'STORAGE_ERROR'
  | 'RECALL_ERROR'
  | 'INTERNAL_ERROR'
```

### 错误约定

- `message`：给开发者看的可读信息
- `details`：字段级错误、冲突原因、底层上下文
- `retryable`：是否建议调用方重试

---

## 5. 共享输入输出结构

## 5.1 Event 输入结构

```ts
export type EventType =
  | 'message'
  | 'tool_call'
  | 'tool_result'
  | 'decision'
  | 'error'
  | 'feedback'
  | 'system'

export type SourceType =
  | 'claude'
  | 'cursor'
  | 'sdk'
  | 'cli'
  | 'mcp'
  | 'system'
  | 'external'

export type ContentStorageMode =
  | 'full_text'
  | 'summary_only'
  | 'structured_only'
  | 'external_ref'

export interface IngestEventInput {
  projectId: ProjectId
  userId: UserId
  event: {
    agentId?: AgentId
    eventType: EventType
    sourceType: SourceType
    scope: ScopeRef
    title?: string
    summary?: string
    contentText?: string
    payload?: Record<string, unknown>
    contentStorageMode?: ContentStorageMode
    importanceScore?: number
    happenedAt?: ISODateTime
  }
  options?: {
    autoExtractMemories?: boolean
    autoExtractEntities?: boolean
    deduplicate?: boolean
    idempotencyKey?: string
  }
}
```

### 输入约束

- `projectId` 必填
- `userId` 必填
- `event.eventType` 必填
- `event.sourceType` 必填
- `event.scope.type` 必填
- `importanceScore` 如果传入，必须在 `0~1`
- `contentStorageMode` 默认 `full_text`
- `happenedAt` 默认使用当前 UTC 时间

## 5.2 Memory 相关结构

```ts
export type MemoryType =
  | 'fact'
  | 'preference'
  | 'constraint'
  | 'task_state'
  | 'experience'

export type MemoryStatus =
  | 'active'
  | 'cooling'
  | 'invalidated'
  | 'archived'

export type MemorySourceStrategy =
  | 'manual'
  | 'auto_extract'
  | 'merged'
  | 'consolidated'

export interface MemoryExplanation {
  reasonSummary?: string
  rankingFactors?: Array<{
    factor: 'context' | 'semantic' | 'strength' | 'reliability'
    score: number
    note?: string
  }>
  evidenceEventIds?: EventId[]
  relatedDocumentIds?: DocumentId[]
  relatedMemoryIds?: MemoryId[]
}

export interface MemoryRecord {
  id: MemoryId
  projectId: ProjectId
  userId: UserId
  memoryType: MemoryType
  scope: ScopeRef
  title: string
  content: string
  summary?: string
  status: MemoryStatus
  confidence: number
  strength: number
  decayScore: number
  importanceScore: number
  accessCount: number
  successCount: number
  failureCount: number
  lastAccessedAt?: ISODateTime
  lastVerifiedAt?: ISODateTime
  lastReinforcedAt?: ISODateTime
  expiresAt?: ISODateTime
  sourceStrategy: MemorySourceStrategy
  explanation?: MemoryExplanation
  metadata?: Record<string, unknown>
  createdAt: ISODateTime
  updatedAt: ISODateTime
}
```

## 5.3 Document 相关结构

```ts
export type DocumentType =
  | 'note'
  | 'summary'
  | 'decision'
  | 'guide'
  | 'knowledge'
  | 'external_index'

export type DocumentSourceType =
  | 'system_generated'
  | 'obsidian'
  | 'yuque'
  | 'notion'
  | 'manual'
  | 'external'

export type CanonicalStorage = 'database' | 'markdown' | 'external'

export type DocumentStatus = 'active' | 'stale' | 'archived'

export interface DocumentRecord {
  id: DocumentId
  projectId: ProjectId
  userId: UserId
  documentType: DocumentType
  sourceType: DocumentSourceType
  sourceUri?: string
  title: string
  slug?: string
  summary?: string
  contentMarkdown?: string
  canonicalStorage: CanonicalStorage
  status: DocumentStatus
  lastSyncedAt?: ISODateTime
  metadata?: Record<string, unknown>
  createdAt: ISODateTime
  updatedAt: ISODateTime
}
```

## 5.4 Feedback 相关结构

```ts
export type FeedbackTargetType = 'memory' | 'document' | 'recall_result'

export type FeedbackSignalType =
  | 'confirmed'
  | 'rejected'
  | 'used_successfully'
  | 'used_unsuccessfully'
  | 'retrieved'
  | 'ignored'
  | 'conflicted'
  | 'merged'

export interface FeedbackInput {
  projectId: ProjectId
  userId: UserId
  feedback: {
    agentId?: AgentId
    targetType: FeedbackTargetType
    targetId: string
    signalType: FeedbackSignalType
    signalValue: number
    reason?: string
    context?: Record<string, unknown>
  }
  options?: {
    applyImmediately?: boolean
    idempotencyKey?: string
  }
}
```

### 输入约束

- `signalValue` 必须在 `-1~1`
- `targetId` 允许是 memory/document/recall_result 的逻辑标识
- 多态目标存在性由应用层校验

## 5.5 Recall 相关结构

```ts
export interface RecallOptions {
  limit?: number
  memoryTypes?: MemoryType[]
  minConfidence?: number
  minStrength?: number
  includeExplanation?: boolean
  includeEvidence?: boolean
  includeDocuments?: boolean
}

export interface RecallMemoryInput {
  projectId: ProjectId
  userId: UserId
  query: string
  scope?: Partial<ScopeRef>
  context?: {
    currentTask?: string
    activeEntities?: string[]
    sourceType?: SourceType
  }
  options?: RecallOptions
}

export interface RecallResultItem {
  memory: MemoryRecord
  score: number
  explanation?: MemoryExplanation
}

export interface MemoryPacket {
  activeFacts: MemoryRecord[]
  constraints: MemoryRecord[]
  preferences: MemoryRecord[]
  taskState: MemoryRecord[]
  experiences: MemoryRecord[]
  supportingDocuments: DocumentRecord[]
  trace: Array<{
    memoryId: MemoryId
    evidenceEventIds?: EventId[]
    documentIds?: DocumentId[]
  }>
}
```

---

## 6. `ingestEvent`

## 6.1 作用

将任意客户端事件写入系统，是 Memory OS 的统一写入口。

## 6.2 方法签名

```ts
export interface IngestEventResult {
  eventId: EventId
  accepted: boolean
  deduplicated: boolean
  extractedMemoryIds: MemoryId[]
  extractedEntityIds: EntityId[]
}

export type IngestEventApi = (
  input: IngestEventInput
) => Promise<ApiResponse<IngestEventResult>>
```

## 6.3 语义规则

1. 事件一旦 accepted，就必须持久化到 `events`
2. 若启用 `deduplicate` 且命中重复，返回已接受事件的逻辑结果，但不重复插入核心事件数据
3. 若启用 `autoExtractMemories`，允许在当前调用内同步触发提炼
4. 若启用 `autoExtractEntities`，允许同步触发实体识别与关联
5. 自动提炼失败不应回滚事件落库，除非调用方显式要求强事务语义

## 6.4 幂等性

### 推荐策略

- 优先使用 `options.idempotencyKey`
- 若未提供，可退化为应用层哈希：
  - `projectId`
  - `userId`
  - `eventType`
  - `sourceType`
  - `contentText/payload`
  - `happenedAt`

### 幂等结果

- 命中幂等：`accepted=true`，`deduplicated=true`
- 新写入：`accepted=true`，`deduplicated=false`

## 6.5 常见错误

- `INVALID_INPUT`：缺失必填字段、score 越界、scope 不合法
- `NOT_FOUND`：`projectId` 不存在
- `STORAGE_ERROR`：事件写入失败
- `INTERNAL_ERROR`：自动提炼链路异常且未被安全降级处理

---

## 7. `extractMemories`

## 7.1 作用

从一个或多个事件中提炼可召回记忆。

## 7.2 方法签名

```ts
export interface ExtractMemoriesInput {
  projectId: ProjectId
  userId: UserId
  eventIds: EventId[]
  strategy?: {
    memoryTypes?: MemoryType[]
    mergeSimilar?: boolean
    createEntities?: boolean
    overwriteExisting?: boolean
  }
}

export interface ExtractMemoriesResult {
  created: MemoryId[]
  updated: MemoryId[]
  skipped: Array<{
    eventId: EventId
    reason: string
  }>
}

export type ExtractMemoriesApi = (
  input: ExtractMemoriesInput
) => Promise<ApiResponse<ExtractMemoriesResult>>
```

## 7.3 语义规则

1. 输入事件必须全部属于同一个 `projectId`
2. 输入事件必须能被当前 `userId` 访问
3. `memoryTypes` 为空时，采用系统默认提炼策略
4. `mergeSimilar=true` 时，允许将新记忆合并到已有 active/cooling memory
5. `overwriteExisting=true` 只允许覆盖系统自动生成的可合并记忆，不应无条件覆盖人工修订内容

## 7.4 输出解释

- `created`：新建 memory
- `updated`：合并或强化了已有 memory
- `skipped`：因内容不足、重复、低价值等原因未生成

## 7.5 常见错误

- `INVALID_INPUT`：`eventIds` 为空、strategy 参数冲突
- `NOT_FOUND`：某些 `eventIds` 不存在
- `CONFLICT`：事件不属于同一项目或同一逻辑批次
- `STORAGE_ERROR`：memory 写入或关系表写入失败

---

## 8. `recallMemories`

## 8.1 作用

根据当前问题与上下文召回 memory packet，是系统最核心的读取能力。

## 8.2 方法签名

```ts
export interface RecallMemoryResult {
  items: RecallResultItem[]
  packet: MemoryPacket
  meta: {
    totalCandidates: number
    returnedItems: number
    explainabilityEnabled: boolean
    evidenceEnabled: boolean
    documentsEnabled: boolean
  }
}

export type RecallMemoriesApi = (
  input: RecallMemoryInput
) => Promise<ApiResponse<RecallMemoryResult>>
```

## 8.3 输入语义

### 必填

- `projectId`
- `userId`
- `query`

### 可选

- `scope`
- `context.currentTask`
- `context.activeEntities`
- `context.sourceType`
- `options`

## 8.4 `options` 默认值建议

```ts
{
  limit: 10,
  includeExplanation: true,
  includeEvidence: false,
  includeDocuments: true
}
```

## 8.5 语义规则

1. recall 只返回适用于当前 `projectId` 的数据
2. recall 必须受 `scope` 过滤影响
3. recall 应默认过滤 `invalidated` 与已过期 memory
4. recall 结果必须按照统一排序模型输出
5. `packet` 是面向 agent 的消费结构，`items` 是面向调试和解释的候选结构

## 8.6 排序要求

V1 按四因子模型排序：

1. 情境相关性
2. 语义相关性
3. 强度与新近性
4. 证据可靠性 / 反馈信号

API 层不暴露内部全部公式，但应允许返回原因摘要。

## 8.7 explainability 约束

- `includeExplanation=true`：返回 `RecallResultItem.explanation`
- `includeEvidence=true`：允许返回 `evidenceEventIds`
- `includeDocuments=true`：允许将文档注入 `packet.supportingDocuments`

## 8.8 常见错误

- `INVALID_INPUT`：query 为空、options 越界
- `NOT_FOUND`：project 不存在
- `RECALL_ERROR`：召回流程异常
- `STORAGE_ERROR`：底层查询失败

---

## 9. `submitFeedback`

## 9.1 作用

提交用户或系统对记忆、文档、召回结果的反馈，用于强化、衰减与纠偏。

## 9.2 方法签名

```ts
export interface SubmitFeedbackResult {
  feedbackId: FeedbackId
  applied: boolean
  affectedMemoryIds: MemoryId[]
}

export type SubmitFeedbackApi = (
  input: FeedbackInput
) => Promise<ApiResponse<SubmitFeedbackResult>>
```

## 9.3 语义规则

1. 所有反馈必须先落 `feedback_signals`
2. 若 `applyImmediately=true`，允许同步更新 memory 强度、状态、计数
3. 若 `applyImmediately=false`，可由异步任务统一处理
4. 指向 `recall_result` 的反馈，允许拆解并映射到多个 memory

## 9.4 强化/衰减映射建议

- `confirmed` / `used_successfully`：增加 `strength`，更新 `success_count`
- `rejected` / `used_unsuccessfully`：增加 `failure_count`，必要时提升 `decay_score`
- `ignored`：不直接判错，但可作为弱负反馈
- `conflicted`：允许建立 `memory_links(conflicts)` 或触发状态降级

## 9.5 幂等性

同样建议支持 `options.idempotencyKey`，避免重复点击或重复上报造成强化失真。

## 9.6 常见错误

- `INVALID_INPUT`：signalValue 越界、targetType 非法
- `NOT_FOUND`：目标对象不存在
- `CONFLICT`：目标对象与 projectId 不匹配
- `STORAGE_ERROR`：反馈落库失败

---

## 10. `consolidateDocument`

## 10.1 作用

将稳定、高价值记忆沉淀为文档，形成长期知识资产。

## 10.2 方法签名

```ts
export interface ConsolidateDocumentInput {
  projectId: ProjectId
  userId: UserId
  memoryIds: MemoryId[]
  target: {
    documentId?: DocumentId
    documentType: DocumentType
    title: string
    sourceType: DocumentSourceType
    canonicalStorage: CanonicalStorage
    sourceUri?: string
    slug?: string
  }
  options?: {
    updateExisting?: boolean
    generateSummary?: boolean
    registerExternalOnly?: boolean
  }
}

export interface ConsolidateDocumentResult {
  document: DocumentRecord
  linkedMemoryIds: MemoryId[]
  created: boolean
  updated: boolean
}

export type ConsolidateDocumentApi = (
  input: ConsolidateDocumentInput
) => Promise<ApiResponse<ConsolidateDocumentResult>>
```

## 10.3 语义规则

1. `memoryIds` 必须全部属于同一 `projectId`
2. `registerExternalOnly=true` 时，可只登记外部文档信息而不写 `contentMarkdown`
3. `updateExisting=true` 时，允许更新已有 document 并重建/补充 `memory_document_links`
4. `canonicalStorage='markdown'` 时，数据库仍保留结构化登记记录

## 10.4 输出语义

- `created=true`：新建 document
- `updated=true`：更新已有 document
- 两者不应同时为 true

## 10.5 常见错误

- `INVALID_INPUT`：`memoryIds` 为空、target 信息不完整
- `NOT_FOUND`：memory 或 target.documentId 不存在
- `CONFLICT`：memory 不属于同一 project
- `STORAGE_ERROR`：document 或 link 写入失败

---

## 11. `traceMemory`

## 11.1 作用

支持记忆的可解释追踪，回答“这条记忆从哪里来、和谁有关、沉淀到哪里去”。

## 11.2 方法签名

```ts
export interface TraceMemoryInput {
  memoryId: MemoryId
  options?: {
    includeEvents?: boolean
    includeDocuments?: boolean
    includeLinkedMemories?: boolean
  }
}

export interface TraceMemoryResult {
  memory: MemoryRecord
  evidenceEvents?: Array<{
    id: EventId
    eventType: string
    summary?: string
    happenedAt: ISODateTime
  }>
  relatedDocuments?: DocumentRecord[]
  linkedMemories?: Array<{
    memoryId: MemoryId
    linkType: 'supports' | 'conflicts' | 'derived_from' | 'supersedes' | 'related_to'
  }>
  meta: {
    evidenceCount: number
    documentCount: number
    linkedMemoryCount: number
  }
}

export type TraceMemoryApi = (
  input: TraceMemoryInput
) => Promise<ApiResponse<TraceMemoryResult>>
```

## 11.3 语义规则

1. `memoryId` 必须存在
2. 默认至少返回 `memory`
3. 其余信息按 `options` 裁剪
4. `traceMemory` 不做召回排序，只做关系追踪

## 11.4 常见错误

- `NOT_FOUND`：memory 不存在
- `STORAGE_ERROR`：trace 查询失败
- `INTERNAL_ERROR`：mapper 或聚合阶段失败

---

## 12. 幂等性策略

## 12.1 必须支持幂等的接口

以下 command 建议支持幂等：

- `ingestEvent`
- `submitFeedback`
- `consolidateDocument`

## 12.2 可选支持幂等的接口

- `extractMemories`

原因：同一批事件重复提炼，在 `mergeSimilar` 策略下通常应得到稳定结果。

## 12.3 幂等实现建议

优先级：

1. 调用方传 `idempotencyKey`
2. 由 adapter 自动生成逻辑哈希
3. service 层做时间窗口去重

V1 不强制建立单独的 `idempotency_keys` 表，但如果实现过程中发现重复写入风险高，可以补充轻量表或缓存层。

---

## 13. 事务边界建议

## 13.1 推荐强事务场景

- `extractMemories`
  - memory 主记录写入
  - `event_memory_links` 写入
  - `memory_entities` 写入

- `consolidateDocument`
  - document 写入
  - `memory_document_links` 写入
  - `document_entities` 写入

## 13.2 推荐弱事务场景

- `ingestEvent`
  - 事件落库成功后，自动提炼失败可降级为异步补偿

- `submitFeedback`
  - feedback 落库成功后，强化更新可允许异步执行

这样可以兼顾可靠性与系统韧性。

---

## 14. Adapter 映射建议

## 14.1 SDK Adapter

最直接映射到 service 方法：

```ts
memoryOs.ingestEvent(input)
memoryOs.extractMemories(input)
memoryOs.recallMemories(input)
memoryOs.submitFeedback(input)
memoryOs.consolidateDocument(input)
memoryOs.traceMemory(input)
```

## 14.2 CLI Adapter

建议映射为子命令：

```text
memory-os ingest
memory-os extract
memory-os recall
memory-os feedback
memory-os consolidate
memory-os trace
```

## 14.3 Skill Adapter

建议映射为高层语义动作：

- `memory_recall`
- `memory_ingest`
- `memory_feedback`
- `memory_consolidate`

skill 层应只负责参数拼装与结果展示，不应复制核心业务逻辑。

## 14.4 MCP Adapter

适合暴露为工具：

- `recall_memories`
- `ingest_event`
- `submit_feedback`
- `trace_memory`

如果后续支持 MCP，建议保持参数命名与本文档一致，降低多接口心智负担。

---

## 15. 测试建议

## 15.1 单元测试

覆盖：

- 输入校验
- 错误映射
- 选项默认值
- explanation 裁剪逻辑

## 15.2 集成测试

覆盖：

- `ingestEvent -> extractMemories`
- `recallMemories -> submitFeedback`
- `consolidateDocument -> traceMemory`
- 幂等性重复调用
- 跨 project 的隔离性

## 15.3 端到端测试

覆盖：

- Claude / Cursor / SDK 三类典型接入链路
- recall 结果对 agent 上下文注入是否稳定
- feedback 是否影响后续 recall 排序

---

## 16. V1 暂不纳入的 API 能力

以下能力暂不进入 V1 正式接口集：

- `deleteMemory`
- `deleteDocument`
- `listProjects`
- `listMemories` 通用搜索接口
- 批量回溯修复接口
- 向量检索专用接口
- 高级管理后台接口

原因很简单：V1 先围绕闭环 API 建立稳定系统，不引入过多管理型接口。

---

## 17. 总结

这份 API 文档已经把 Memory OS 的核心接口从“架构级定义”推进到了“实现级契约”。

现在已经明确了：

- 每个接口的输入输出结构
- Command / Query 边界
- 幂等性要求
- 事务边界建议
- Adapter 映射方向
- 测试重点

基于本文档，下一阶段已经可以直接继续产出：

- `docs/recall-engine.md`
- service 层 TypeScript 接口定义
- SDK facade
- CLI / MCP / skill adapter 参数映射
