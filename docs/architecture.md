# Memory OS 架构设计文档

- **文档类型**：架构设计 / RFC 草案
- **状态**：Implemented (V1 已完成)
- **目标读者**：协作开发者、未来维护者、接入方开发者
- **设计范围**：V1 本地优先 Memory OS
- **最后更新**：2026-04-01

## 当前实现状态

V1 核心闭环已实现完成：

```
event -> memory -> recall
```

已实现功能：
- 项目、事件、记忆、事件-记忆关联四张表 Schema
- 完整 CRUD 仓储层（InMemory + SQLite 双实现）
- 事件摄入服务（去重、校验）
- LLM 记忆提取服务（调用 Anthropic Claude）
- 相似度召回服务（词重叠 + 排序分组 + 证据溯源）
- Hono HTTP API（三个端点）
- 完整单元测试 + 集成测试（175 测试全部通过）

未实现（计划未来）：
- feedback_signals 反馈信号表
- documents 文档沉淀
- entities 实体抽取
- 记忆强度衰减机制


---

## 执行摘要

Memory OS 是一个面向多智能体的本地优先记忆中间层，用于为 Claude、Cursor、自建 agent 等系统提供统一的记忆读写、召回、反馈强化与知识沉淀能力。

它不试图在 V1 直接模拟完整人脑，而是优先构建一个可运行的工程闭环：

- 以 **Event** 作为原始输入
- 以 **Memory** 作为可召回认知
- 以 **Document** 作为外部长期知识沉淀
- 以 **Feedback** 作为强化、衰减与纠偏机制
- 以 **Adapter / Skill** 作为多客户端接入方式

V1 采用 **本地优先 + SQLite + TypeScript** 的实现路线，目标是在复杂度可控的前提下，优先解决以下问题：

1. 跨会话失忆
2. 跨智能体记忆割裂
3. 有价值信息无法沉淀为长期知识资产
4. 召回结果不可控、不可解释

本设计文档的最终目标不是展示概念，而是直接指导后续实现。

---

## 1. 背景与目标

当前主流智能体（如 Claude、Cursor 等）在记忆能力上存在几个共性问题：

1. **跨会话失忆**：新的对话无法自然继承旧任务上下文。
2. **跨智能体割裂**：一个智能体积累的经验，另一个智能体无法直接使用。
3. **知识沉淀不足**：大量有价值的工作结果停留在会话中，未形成可复用知识资产。
4. **记忆不可控**：要么什么都不记，要么无差别存储，导致召回不准、噪声过高。
5. **外部知识库与内部记忆割裂**：智能体内部记忆和人类维护的文档/笔记系统没有形成闭环。

本项目的目标是构建一个 **面向多智能体的本地优先 Memory OS**，作为 Claude、Cursor、自建 agent 等系统的统一记忆中间层。

### 1.1 核心目标

- 为多个智能体提供统一的记忆读写能力
- 支持多用户、多项目作用域下的记忆隔离与共享
- 将事件、记忆、文档组织成一个可演进的记忆体系
- 同时兼顾 **准确性、可解释性、性能**
- 支持自动写入、自动召回、反馈强化与知识沉淀
- 支持以 **skills / adapter** 形式嵌入不同智能体客户端

### 1.2 V1 成果定义

V1 不追求完整能力覆盖，而追求建立一个稳定闭环：

```text
event -> memory -> recall -> feedback -> document
```

只要这个闭环成立，并且能被多个智能体共享使用，V1 就具备独立价值。

---

## 2. 非目标与边界

### 2.1 V1 非目标

V1 明确不做以下事项：

- 多租户架构
- 分布式部署与云原生高可用
- 复杂权限系统
- 图数据库级别的复杂知识推理
- 完整的记忆版本化系统
- 重型向量基础设施强绑定
- 完整外部知识库双向同步
- 面向终端用户的复杂图形界面

### 2.2 V1 范围边界

V1 聚焦于：

- 本地优先运行
- SQLite 存储
- 事件 -> 记忆 -> 文档 的主链路闭环
- 基础召回与解释能力
- 基础反馈强化与衰减
- skill / adapter 式接入

### 2.3 明确不在 V1 内解决的问题

- 团队级权限协同
- 海量数据下的分片与水平扩展
- 高级 UI 检索体验
- 完整自动知识库同步平台
- 复杂的 agent 注册中心

---

## 3. 术语表

### 3.1 Event
表示“发生了什么”的原始事件，例如对话轮次、工具调用、错误、决策、反馈。

### 3.2 Memory
表示“系统学到了什么”的可召回认知单元，例如事实、偏好、约束、任务状态、经验。

### 3.3 Document
表示稳定知识的外部化沉淀结果，可为系统生成 Markdown，也可为外部知识库文档索引。

### 3.4 Entity
表示上下文锚点，用于提升召回质量，例如 repo、file、service、concept、task。

### 3.5 Recall
表示根据当前问题与上下文，从 Memory OS 中取回最相关记忆的过程。

### 3.6 Feedback
表示对记忆或召回结果的确认、否定、成功使用、失败使用等信号。

### 3.7 Memory Packet
表示返回给智能体的结构化记忆包，而不是原始事件堆。

---

## 4. 设计原则

### 4.1 本地优先
系统默认在本地单机运行，避免 V1 被服务化复杂度拖垮。

### 4.2 事件优先
一切记忆都从事件中产生。事件是原材料，记忆是提炼结果，文档是长期沉淀。

### 4.3 分层记忆
最小记忆单位采用分层混合模型：

- **Event**：原始发生的事情
- **Memory**：从事件提炼出的可复用认知
- **Document**：稳定知识的外部化表达

### 4.4 可解释优先于黑盒效果
召回结果必须能说明“为什么想起这条”，而不是仅返回神秘相似度结果。

### 4.5 skill 是接入层，不是核心层
客户端可以通过 skill 接入，但记忆逻辑必须统一收敛在 Memory OS 内核中。

### 4.6 数据库为准，Markdown 为人读沉淀
结构化状态以数据库为主，Markdown 用于知识沉淀、人工审阅和长期维护。

### 4.7 渐进式演进
V1 先实现可用闭环，不为未来可能永远不会发生的需求过度设计。

### 4.8 配置优先于硬编码
召回解释性、证据返回、文档包含等行为必须可配置，而不是写死在客户端。

---

## 5. 架构总览

### 5.1 逻辑分层

系统分为四层：

1. **Client Layer**
   - Claude
   - Cursor
   - 自建 Agent
   - 其他接入方

2. **Adapter Layer**
   - Skill Adapter
   - CLI Adapter
   - SDK Adapter
   - 可选 MCP Adapter

3. **Memory Core Layer**
   - Event Ingestion
   - Memory Extraction
   - Recall Engine
   - Feedback Engine
   - Document Consolidation

4. **Storage Layer**
   - SQLite
   - Markdown 文档目录
   - 可选外部文档索引登记

### 5.2 主链路

```text
客户端请求
  -> recall
  -> memory packet 注入上下文
  -> 任务执行
  -> ingest 事件
  -> extract memories
  -> submit feedback
  -> consolidate document
```

### 5.3 设计决策摘要

- **本地优先**：降低部署与实验成本
- **SQLite**：降低 V1 技术复杂度
- **数据库为准**：保障结构化读写一致性
- **Markdown 沉淀**：便于人工审阅与长期维护
- **Adapter 接入**：避免与单一客户端深度耦合

---

## 6. 核心对象模型

系统核心对象分为四类：

### 6.1 Event
事件表示“发生了什么”，是原始输入层。
例如：

- 一次用户提问
- 一次智能体回答
- 一次工具调用
- 一次错误
- 一次决策
- 一次反馈

### 6.2 Memory
记忆表示“系统学到了什么”，是可召回的认知单元。
V1 重点支持以下核心类型：

- `fact`
- `preference`
- `constraint`
- `task_state`
- `experience`

同时在类型设计中保留：
- `episodic`
- `semantic`
- `procedural`
等扩展空间。

### 6.3 Document
文档表示“哪些内容已经沉淀为长期知识资产”。
既可以是系统生成的 Markdown，也可以是外部知识库文档的登记索引。

### 6.4 Entity
实体是上下文召回的轻量语义锚点。
例如：

- user
- project
- repo
- file
- service
- api
- tool
- concept
- task

实体不追求构建复杂知识图谱，而是用于帮助召回上下文化。

---

## 7. 数据模型设计

### 7.1 总体设计

V1 使用 SQLite 存储，围绕以下 6 张主表和 6 张关系表组织：

#### 主表
1. `projects`
2. `events`
3. `memories`
4. `documents`
5. `entities`
6. `feedback_signals`

#### 关系表
7. `event_entities`
8. `memory_entities`
9. `document_entities`
10. `memory_links`
11. `event_memory_links`
12. `memory_document_links`

核心关系链路为：

```text
event -> memory -> document
```

并通过 entity 与 feedback 为召回、强化、解释提供支撑。

### 7.2 projects

项目是顶层隔离边界之一，V1 使用扁平 project 模型。

关键字段：

- `id`
- `slug`
- `name`
- `description`
- `owner_user_id`
- `status`
- `settings_json`
- `created_at`
- `updated_at`

说明：

- 不单独建立 `users` 表
- `owner_user_id` 为字符串标识
- `settings_json` 存放项目级召回、解释、写入策略开关

### 7.3 events

事件表是系统原材料层。

关键字段：

- `id`
- `project_id`
- `user_id`
- `agent_id`
- `event_type`
- `source_type`
- `scope_type`
- `scope_key`
- `title`
- `summary`
- `content_text`
- `payload_json`
- `content_storage_mode`
- `importance_score`
- `happened_at`
- `created_at`

说明：

- 不建立 `agents` 表，`agent_id` 直接作为字符串字段存在
- 事件内容允许按类型分存：
  - 全文
  - 摘要
  - 结构化 payload
  - 外部引用

### 7.4 memories

记忆表是系统真正的可召回认知层。

关键字段：

- `id`
- `project_id`
- `user_id`
- `memory_type`
- `scope_type`
- `scope_key`
- `title`
- `content`
- `summary`
- `status`
- `confidence`
- `strength`
- `decay_score`
- `importance_score`
- `access_count`
- `success_count`
- `failure_count`
- `last_accessed_at`
- `last_verified_at`
- `last_reinforced_at`
- `expires_at`
- `source_strategy`
- `explanation_json`
- `metadata_json`
- `created_at`
- `updated_at`

说明：

- V1 不做记忆版本化
- 更新采用原地更新方式
- `strength` 和 `confidence` 通过 feedback 和 recall 行为动态变化

### 7.5 documents

文档表用于管理外部知识沉淀。

关键字段：

- `id`
- `project_id`
- `user_id`
- `document_type`
- `source_type`
- `source_uri`
- `title`
- `slug`
- `summary`
- `content_markdown`
- `canonical_storage`
- `status`
- `last_synced_at`
- `metadata_json`
- `created_at`
- `updated_at`

说明：

- 支持系统生成文档
- 支持外部文档登记（Obsidian / Yuque / Notion 等）
- V1 采用“数据库为准、Markdown 为人读沉淀”的策略

### 7.6 entities

实体表用于增强上下文化召回。

关键字段：

- `id`
- `project_id`
- `entity_type`
- `name`
- `normalized_name`
- `description`
- `aliases_json`
- `metadata_json`
- `created_at`
- `updated_at`

说明：

- 实体保持轻量，不做复杂图推理
- 主要服务 recall 与 document linking

### 7.7 feedback_signals

反馈表用于强化、衰减与纠错。

关键字段：

- `id`
- `project_id`
- `user_id`
- `agent_id`
- `target_type`
- `target_id`
- `signal_type`
- `signal_value`
- `reason`
- `context_json`
- `created_at`

反馈信号包括：

- `confirmed`
- `rejected`
- `used_successfully`
- `used_unsuccessfully`
- `retrieved`
- `ignored`
- `conflicted`
- `merged`

### 7.8 关系表设计

#### event_entities
记录事件提到了哪些实体。

#### memory_entities
记录记忆与哪些实体相关，是召回的重要索引。

#### document_entities
记录文档与哪些实体相关。

#### memory_links
记录记忆之间的支持、冲突、派生、替代关系。

#### event_memory_links
记录某条记忆由哪些事件支撑。

#### memory_document_links
记录某条记忆沉淀到了哪些文档。

---

## 8. TypeScript 类型设计

### 8.1 基础类型

系统统一 ID、时间、作用域类型：

- `ID`
- `ISODateTime`
- `ProjectId`
- `UserId`
- `AgentId`
- `EventId`
- `MemoryId`
- `DocumentId`
- `EntityId`
- `FeedbackId`

作用域使用显式模型：

```ts
type ScopeType = 'global' | 'user' | 'project' | 'user_project' | 'custom'
```

说明：

- 因为系统要求支持 **用户 + 项目双作用域**
- 作用域不能只靠字符串拼接表达

### 8.2 Event 类型

事件类型定义原始输入层，包含：

- `EventType`
- `SourceType`
- `ContentStorageMode`
- `Event`
- `IngestEventInput`

其职责是表达“发生了什么”，而不是“系统学到了什么”。

### 8.3 Memory 类型

记忆类型定义系统的认知层，包含：

- `MemoryType`
- `MemoryStatus`
- `MemorySourceStrategy`
- `MemoryExplanation`
- `Memory`
- `CreateMemoryInput`
- `UpdateMemoryInput`

特别强调：

- `MemoryExplanation` 是一等结构
- 排序理由、证据来源、相关文档必须可表达
- 这是可解释召回的基础

### 8.4 Document 类型

文档类型定义长期知识沉淀层，包含：

- `DocumentType`
- `DocumentSourceType`
- `CanonicalStorage`
- `DocumentStatus`
- `Document`

其目标是同时支持：
- 系统生成 Markdown
- 外部文档索引登记

### 8.5 Entity 类型

实体类型定义上下文锚点层，包含：

- `EntityType`
- `Entity`

目标是服务召回，而不是构建重型知识图谱。

### 8.6 Feedback 类型

反馈类型定义系统如何“学习”：

- `FeedbackTargetType`
- `FeedbackSignalType`
- `FeedbackSignal`

反馈既可以指向：
- memory
- document
- recall_result

### 8.7 Recall 类型

召回相关类型是 API 核心，包含：

- `RecallOptions`
- `RecallMemoryInput`
- `RecallResultItem`
- `MemoryPacket`
- `RecallMemoryResult`

其中 `MemoryPacket` 是智能体最主要的消费对象，包含：

- `activeFacts`
- `constraints`
- `preferences`
- `taskState`
- `experiences`
- `supportingDocuments`
- `trace`

### 8.8 Persistence 类型

数据库记录类型与领域类型分离。

原因：

- 数据库使用 snake_case
- 业务层使用 camelCase
- SQLite 中 JSON 实际存为 TEXT
- nullable 字段与 optional 字段在语义上不同

因此系统必须通过 mapper 在 persistence model 与 domain model 之间转换。

---

## 9. API 契约设计

### 9.1 设计原则

V1 API 契约按 Command / Query 分离：

#### Command
- `ingestEvent`
- `extractMemories`
- `consolidateDocument`
- `submitFeedback`

#### Query
- `recallMemories`
- `traceMemory`

这样无论未来接入方式是：
- SDK
- CLI
- skill
- MCP
- HTTP

都可以稳定映射。

### 9.2 ingestEvent

作用：
将任意客户端事件写入系统，是 Memory OS 的统一入口。

输入：
- `event`
- `options.autoExtractMemories`
- `options.autoExtractEntities`
- `options.deduplicate`

输出：
- `eventId`
- `accepted`
- `extractedMemoryIds`
- `extractedEntityIds`

### 9.3 extractMemories

作用：
从一个或多个事件中提炼记忆。

输入：
- `projectId`
- `userId`
- `eventIds`
- `strategy.memoryTypes`
- `strategy.mergeSimilar`
- `strategy.createEntities`
- `strategy.overwriteExisting`

输出：
- `created`
- `updated`
- `skipped`

### 9.4 recallMemories

作用：
根据当前上下文召回 memory packet，是系统最核心能力。

输入：
- `projectId`
- `userId`
- `query`
- `scope`
- `context`
- `options`

输出：
- `items`
- `packet`
- `meta`

要求：
- 支持 explainability 开关
- 支持 evidence 开关
- 支持 documents 开关
- 支持按 memory type / confidence / strength 过滤

### 9.5 consolidateDocument

作用：
将一组高价值记忆沉淀为文档。

输入：
- `projectId`
- `userId`
- `memoryIds`
- `target.documentId`
- `target.documentType`
- `target.title`
- `target.sourceType`
- `target.canonicalStorage`
- `options.updateExisting`
- `options.generateSummary`
- `options.registerExternalOnly`

输出：
- `document`
- `linkedMemoryIds`
- `created`
- `updated`

### 9.6 submitFeedback

作用：
提交记忆、召回、文档层的反馈，用于强化和纠错。

输入：
- `feedback`
- `options.applyImmediately`

输出：
- `feedbackId`
- `applied`
- `affectedMemoryIds`

### 9.7 traceMemory

作用：
支持可解释性追踪。

输入：
- `memoryId`
- `options.includeEvents`
- `options.includeDocuments`
- `options.includeLinkedMemories`

输出：
- `memory`
- `evidenceEvents`
- `relatedDocuments`
- `linkedMemories`
- `meta`

### 9.8 统一响应格式

系统统一采用：

```ts
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
}
```

错误类型包括：

- `INVALID_INPUT`
- `NOT_FOUND`
- `CONFLICT`
- `UNSUPPORTED_OPERATION`
- `STORAGE_ERROR`
- `RECALL_ERROR`
- `INTERNAL_ERROR`

---

## 10. 召回与反馈机制

### 10.1 召回目标

召回不是简单的相似度搜索，而是让智能体“在当前情境下想起最该想起的东西”。

### 10.2 四因子召回模型

V1 使用四因子排序：

1. **情境相关性**
2. **语义相关性**
3. **强度与新近性**
4. **证据可靠性 / 反馈信号**

### 10.3 召回结果形式

不直接返回原始事件堆，而返回：

- memory packet
- 详细候选条目
- 排名原因
- 可选证据与文档

### 10.4 可解释性要求

可解释性开关重点支持：
- 是否返回排序原因
- 不强制返回所有证据正文
- 保证“为什么想起它”可追溯

### 10.5 强化信号

以下情况会增强记忆：

- 被用户确认
- 被多个事件重复支持
- 被多个智能体成功使用
- 在后续任务中帮助决策成功

### 10.6 衰减信号

以下情况会降低记忆活性：

- 长期未命中
- 使用失败
- 被新证据覆盖
- 与新记忆冲突

### 10.7 V1 纠偏策略

V1 不直接物理删除记忆，而采用：

- 降低 strength
- 提高 decayScore
- 状态切换为 `cooling`
- 必要时 `invalidated`
- 后续再归档

---

## 11. 使用方式与接入方式

本系统最终形态为：

- 一个本地运行的 memory engine
- 一个 SQLite 数据库
- 一套统一记忆 API
- 多个接入适配层：
  - Claude skill adapter
  - Cursor adapter
  - 自建 agent SDK adapter
  - 可选 MCP adapter

### 11.1 Claude 接入
通过 skill 调用：
- recall
- ingest
- feedback
- consolidate

### 11.2 Cursor 接入
通过本地命令或 adapter 调用：
- recall
- ingest
- feedback

### 11.3 自建 agent 接入
通过 SDK 调用统一 API。

### 11.4 接入原则

- 客户端不应自行维护独立记忆格式
- skill 只做接入壳，不做记忆主逻辑
- recall、feedback、consolidate 的行为必须由核心层统一控制

---

## 12. 技术选型与权衡

### 12.1 推荐 V1 技术栈

- **语言**：TypeScript
- **运行时**：Node.js 或 Bun
- **数据库**：SQLite
- **ORM / Query Builder**：Drizzle 或 Kysely
- **输入校验**：Zod
- **测试框架**：Vitest
- **文档输出**：Markdown 文件系统

### 12.2 选型理由

- 与 TypeScript 类型系统天然一致
- 适合本地优先
- 有利于快速构建 skill / SDK / CLI / MCP 适配层
- SQLite 足够支持 V1 的复杂度

### 12.3 关键权衡

#### SQLite vs PostgreSQL
- V1 选择 SQLite，是因为本地优先、部署轻、开发快
- 代价是未来服务化后可能需要迁移
- 结论：V1 选 SQLite，后续通过 repository 与 mapper 降低迁移成本

#### Skill 接入 vs 深度客户端绑定
- Skill 接入可快速覆盖 Claude 场景
- 代价是不同客户端能力不完全一致
- 结论：接入层多样化，核心层统一

#### 数据库为准 vs 文档为准
- 数据库更适合结构化 recall 与 feedback
- 文档更适合人类审阅与维护
- 结论：数据库为准，Markdown 为长期沉淀

---

## 13. 风险与开放问题

### 13.1 风险

1. **Recall 质量不足**
   - 如果排序策略过弱，系统会退化成普通检索器

2. **自动写入噪声过高**
   - 如果抽取策略过宽，Memory 会快速膨胀并污染召回结果

3. **客户端接入不一致**
   - Claude、Cursor、自建 agent 的调用能力不同，可能导致行为差异

4. **SQLite 演进上限**
   - 当数据量和检索需求提升后，可能遇到扩展瓶颈

### 13.2 开放问题

1. V1 是否引入轻量向量索引，还是先完全基于规则 + 文本匹配？
2. skill 接入的标准形态是否要同时支持 CLI 与 MCP？
3. 文档沉淀是否需要立即支持 ADR 模板？
4. recall score 的权重是否应在项目级配置中开放？

---

## 14. 最终项目目录结构建议

```text
memory-os/
├─ docs/
├─ data/
├─ src/
│  ├─ domain/
│  ├─ schemas/
│  ├─ db/
│  ├─ repositories/
│  ├─ services/
│  ├─ adapters/
│  ├─ config/
│  └─ shared/
├─ scripts/
└─ tests/
```

说明：

- `domain/`：领域模型
- `db/`：SQLite schema、迁移、mapper
- `repositories/`：持久化访问层
- `services/`：核心业务逻辑
- `adapters/`：skill、CLI、SDK、MCP 接入层
- `tests/`：单元、集成、端到端测试

---

## 15. V1 实现计划

### 阶段 0：工程骨架
- 初始化 TypeScript 工程
- 建立 SQLite 连接
- 建立迁移机制
- 建立基础配置与错误系统

### 阶段 1：事件接入层
- 建表：projects / events
- 实现 ingestEvent
- 完成事件去重和基础校验

### 阶段 2：记忆抽取层
- 建表：memories / event_memory_links
- 实现 extractMemories
- 支持五类核心记忆提炼

### 阶段 3：召回引擎
- 建表：entities / memory_entities
- 实现 recallMemories
- 实现 memory packet
- 实现基础可解释排序

### 阶段 4：反馈强化层
- 建表：feedback_signals
- 实现 submitFeedback
- 让 feedback 影响 recall 排序

### 阶段 5：文档沉淀层
- 建表：documents / memory_document_links
- 实现 consolidateDocument
- 输出 Markdown 文档

### 阶段 6：接入与验证
- skill adapter
- CLI / SDK
- 端到端测试
- 示例项目验证

---

## 16. V1 成功标准

V1 成功的判定标准为：

1. 不同智能体写入的事件能进入统一系统
2. 系统能自动形成核心记忆类型
3. recall 返回的 memory packet 对任务有实际帮助
4. recall 结果具有基础可解释性
5. feedback 能影响后续召回结果
6. 稳定记忆能沉淀成 Markdown 文档

---

## 17. 总结

本项目定义为：

> 一个本地优先、SQLite 驱动、面向多用户多项目、可通过 skill 与 adapter 接入的 Memory OS。
> 它以 event 为输入，以 memory 为可召回认知，以 document 为外部长期沉淀，通过 feedback 驱动强化、衰减与纠偏，并为多智能体提供统一的可解释记忆能力。

V1 的重点不是模拟完整人脑，而是建立一个真正可运行、可扩展、可被多个智能体共享使用的记忆中间层闭环。
