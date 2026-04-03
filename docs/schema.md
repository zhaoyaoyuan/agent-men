# Memory OS Schema 设计文档

- **文档类型**：实现级 Schema 设计
- **状态**：Draft
- **目标读者**：协作开发者、数据库层实现者、仓储层实现者
- **依赖文档**：`docs/architecture.md`
- **最后更新**：2026-03-27

---

## 1. 文档目标

本文档将 `docs/architecture.md` 中的架构级数据模型，进一步细化为可直接落地到 SQLite 的实现级 schema 设计。

重点解决以下问题：

1. 每张表的字段类型如何定义
2. 哪些字段必须非空，哪些允许为空
3. 主键、唯一约束、检查约束如何设置
4. 哪些索引是 V1 必须具备的
5. 关系表如何保证一致性与可查询性
6. 如何在 SQLite 限制下保持后续演进空间

本文档只覆盖 **V1 SQLite schema**，不覆盖 ORM 具体写法，不覆盖迁移脚本实现细节。

---

## 2. 设计原则

### 2.1 数据库为准

结构化状态以 SQLite 为准，Markdown 只是人类可读沉淀，不作为系统真实状态来源。

### 2.2 主键统一使用文本 ID

V1 所有主键统一使用 `TEXT`，便于：

- 支持 ULID / UUID
- 避免 SQLite 自增 ID 带来的跨系统耦合
- 降低未来迁移到其他存储引擎的成本

建议实现层优先使用 **ULID**，因为它兼具全局唯一性与时间有序性。

### 2.3 JSON 字段统一落 `TEXT`

SQLite 无原生 JSON 列类型，V1 所有 JSON 结构均以 `TEXT` 存储，由应用层负责：

- 序列化
- 反序列化
- 输入校验
- 版本兼容

### 2.4 不做过度外键级联

V1 以安全和可控为主，关系表允许使用外键，但避免复杂级联删除策略造成误删。默认策略：

- 主实体删除：优先由应用层控制
- 关系表删除：可使用 `ON DELETE CASCADE`
- 核心事实数据：不建议物理删除，优先状态化失效

### 2.5 面向召回优化

索引设计优先服务以下查询：

- 按 `project_id + user_id` 过滤
- 按 `memory_type + status` 过滤
- 按 `strength / confidence / updated_at` 排序
- 按实体关联查询记忆
- 按事件追踪记忆来源

---

## 3. SQLite 通用约定

### 3.1 通用字段类型约定

| 类型语义 | SQLite 类型 | 说明 |
|---|---|---|
| ID | `TEXT` | ULID / UUID |
| 短文本 | `TEXT` | slug、type、status 等 |
| 长文本 | `TEXT` | content、markdown、summary |
| 整数 | `INTEGER` | 计数、布尔、时间戳都可用 |
| 小数 | `REAL` | score、confidence、strength |
| JSON | `TEXT` | 应用层序列化 |
| 时间 | `TEXT` | ISO 8601 UTC 字符串 |

### 3.2 时间字段约定

统一使用 ISO 8601 UTC 文本，例如：

```text
2026-03-27T12:34:56.000Z
```

原因：

- 跨语言与跨客户端可读性更好
- 便于日志和调试
- 与 TypeScript `string` 类型映射简单

### 3.3 布尔值约定

SQLite 中布尔统一使用 `INTEGER`：

- `0` = false
- `1` = true

### 3.4 score 范围约定

所有评分字段建议约束到统一范围，避免后续排序失控：

- `importance_score`: `0 ~ 1`
- `confidence`: `0 ~ 1`
- `strength`: `0 ~ 1`
- `decay_score`: `0 ~ 1`
- `signal_value`: `-1 ~ 1`

---

## 4. 枚举约定

V1 不单独建立枚举表，统一使用 `TEXT + CHECK` 约束或应用层校验。

### 4.1 projects

- `status`: `active` | `archived` | `disabled`

### 4.2 events

- `event_type`: `message` | `tool_call` | `tool_result` | `decision` | `error` | `feedback` | `system`
- `source_type`: `claude` | `cursor` | `sdk` | `cli` | `mcp` | `system` | `external`
- `scope_type`: `global` | `user` | `project` | `user_project` | `custom`
- `content_storage_mode`: `full_text` | `summary_only` | `structured_only` | `external_ref`

### 4.3 memories

- `memory_type`: `fact` | `preference` | `constraint` | `task_state` | `experience`
- `status`: `active` | `cooling` | `invalidated` | `archived`
- `source_strategy`: `manual` | `auto_extract` | `merged` | `consolidated`

### 4.4 documents

- `document_type`: `note` | `summary` | `decision` | `guide` | `knowledge` | `external_index`
- `source_type`: `system_generated` | `obsidian` | `yuque` | `notion` | `manual` | `external`
- `canonical_storage`: `database` | `markdown` | `external`
- `status`: `active` | `stale` | `archived`

### 4.5 entities

- `entity_type`: `user` | `project` | `repo` | `file` | `service` | `api` | `tool` | `concept` | `task`

### 4.6 feedback_signals

- `target_type`: `memory` | `document` | `recall_result`
- `signal_type`: `confirmed` | `rejected` | `used_successfully` | `used_unsuccessfully` | `retrieved` | `ignored` | `conflicted` | `merged`

### 4.7 memory_links

- `link_type`: `supports` | `conflicts` | `derived_from` | `supersedes` | `related_to`

---

## 5. 主表设计

## 5.1 `projects`

### 职责

项目级隔离边界与配置载体。

### 建议字段

| 字段 | 类型 | 非空 | 默认值 | 说明 |
|---|---|---:|---|---|
| `id` | `TEXT` | 是 |  | 主键 |
| `slug` | `TEXT` | 是 |  | 人类可读唯一标识 |
| `name` | `TEXT` | 是 |  | 项目名称 |
| `description` | `TEXT` | 否 | `NULL` | 项目描述 |
| `owner_user_id` | `TEXT` | 是 |  | 所属用户标识 |
| `status` | `TEXT` | 是 | `'active'` | 项目状态 |
| `settings_json` | `TEXT` | 否 | `NULL` | 项目级配置 |
| `created_at` | `TEXT` | 是 |  | 创建时间 |
| `updated_at` | `TEXT` | 是 |  | 更新时间 |

### 约束

- `PRIMARY KEY (id)`
- `UNIQUE (slug)`
- `CHECK (status IN ('active','archived','disabled'))`

### 索引

- `idx_projects_owner_user_id (owner_user_id)`
- `idx_projects_status (status)`

### 说明

`slug` 在 V1 中全局唯一，保持简单；如果后续需要支持同用户下重名 slug，再调整为复合唯一键。

---

## 5.2 `events`

### 职责

记录原始发生事实，是记忆提炼的唯一原材料来源。

### 建议字段

| 字段 | 类型 | 非空 | 默认值 | 说明 |
|---|---|---:|---|---|
| `id` | `TEXT` | 是 |  | 主键 |
| `project_id` | `TEXT` | 是 |  | 关联项目 |
| `user_id` | `TEXT` | 是 |  | 关联用户 |
| `agent_id` | `TEXT` | 否 | `NULL` | 智能体标识 |
| `event_type` | `TEXT` | 是 |  | 事件类型 |
| `source_type` | `TEXT` | 是 |  | 来源类型 |
| `scope_type` | `TEXT` | 是 |  | 作用域类型 |
| `scope_key` | `TEXT` | 否 | `NULL` | 自定义 scope 补充值 |
| `title` | `TEXT` | 否 | `NULL` | 事件标题 |
| `summary` | `TEXT` | 否 | `NULL` | 摘要 |
| `content_text` | `TEXT` | 否 | `NULL` | 正文内容 |
| `payload_json` | `TEXT` | 否 | `NULL` | 结构化内容 |
| `content_storage_mode` | `TEXT` | 是 | `'full_text'` | 内容存储模式 |
| `importance_score` | `REAL` | 是 | `0.5` | 重要度评分 |
| `happened_at` | `TEXT` | 是 |  | 事件发生时间 |
| `created_at` | `TEXT` | 是 |  | 入库时间 |

### 约束

- `PRIMARY KEY (id)`
- `FOREIGN KEY (project_id) REFERENCES projects(id)`
- `CHECK (event_type IN (...))`
- `CHECK (source_type IN (...))`
- `CHECK (scope_type IN (...))`
- `CHECK (content_storage_mode IN ('full_text','summary_only','structured_only','external_ref'))`
- `CHECK (importance_score >= 0 AND importance_score <= 1)`

### 索引

- `idx_events_project_user (project_id, user_id)`
- `idx_events_project_happened_at (project_id, happened_at DESC)`
- `idx_events_project_type (project_id, event_type)`
- `idx_events_project_source (project_id, source_type)`
- `idx_events_scope (project_id, scope_type, scope_key)`

### 说明

事件是追加型数据，原则上不更新核心事实，仅允许补充摘要、payload 或修正少量元数据。

---

## 5.3 `memories`

### 职责

系统的核心认知层，是 recall 主要读取对象。

### 建议字段

| 字段 | 类型 | 非空 | 默认值 | 说明 |
|---|---|---:|---|---|
| `id` | `TEXT` | 是 |  | 主键 |
| `project_id` | `TEXT` | 是 |  | 所属项目 |
| `user_id` | `TEXT` | 是 |  | 所属用户 |
| `memory_type` | `TEXT` | 是 |  | 记忆类型 |
| `scope_type` | `TEXT` | 是 |  | 作用域类型 |
| `scope_key` | `TEXT` | 否 | `NULL` | 自定义 scope |
| `title` | `TEXT` | 是 |  | 记忆标题 |
| `content` | `TEXT` | 是 |  | 主内容 |
| `summary` | `TEXT` | 否 | `NULL` | 精简摘要 |
| `status` | `TEXT` | 是 | `'active'` | 状态 |
| `confidence` | `REAL` | 是 | `0.5` | 置信度 |
| `strength` | `REAL` | 是 | `0.5` | 记忆强度 |
| `decay_score` | `REAL` | 是 | `0` | 衰减度 |
| `importance_score` | `REAL` | 是 | `0.5` | 重要度 |
| `access_count` | `INTEGER` | 是 | `0` | 被召回/访问次数 |
| `success_count` | `INTEGER` | 是 | `0` | 成功使用次数 |
| `failure_count` | `INTEGER` | 是 | `0` | 失败使用次数 |
| `last_accessed_at` | `TEXT` | 否 | `NULL` | 最近访问时间 |
| `last_verified_at` | `TEXT` | 否 | `NULL` | 最近验证时间 |
| `last_reinforced_at` | `TEXT` | 否 | `NULL` | 最近强化时间 |
| `expires_at` | `TEXT` | 否 | `NULL` | 过期时间 |
| `source_strategy` | `TEXT` | 是 | `'auto_extract'` | 来源策略 |
| `explanation_json` | `TEXT` | 否 | `NULL` | 解释信息 |
| `metadata_json` | `TEXT` | 否 | `NULL` | 扩展元数据 |
| `created_at` | `TEXT` | 是 |  | 创建时间 |
| `updated_at` | `TEXT` | 是 |  | 更新时间 |

### 约束

- `PRIMARY KEY (id)`
- `FOREIGN KEY (project_id) REFERENCES projects(id)`
- `CHECK (memory_type IN ('fact','preference','constraint','task_state','experience'))`
- `CHECK (status IN ('active','cooling','invalidated','archived'))`
- `CHECK (scope_type IN ('global','user','project','user_project','custom'))`
- `CHECK (source_strategy IN ('manual','auto_extract','merged','consolidated'))`
- `CHECK (confidence >= 0 AND confidence <= 1)`
- `CHECK (strength >= 0 AND strength <= 1)`
- `CHECK (decay_score >= 0 AND decay_score <= 1)`
- `CHECK (importance_score >= 0 AND importance_score <= 1)`
- `CHECK (access_count >= 0)`
- `CHECK (success_count >= 0)`
- `CHECK (failure_count >= 0)`

### 索引

- `idx_memories_project_user (project_id, user_id)`
- `idx_memories_project_type_status (project_id, memory_type, status)`
- `idx_memories_project_scope (project_id, scope_type, scope_key)`
- `idx_memories_project_updated_at (project_id, updated_at DESC)`
- `idx_memories_project_strength (project_id, strength DESC)`
- `idx_memories_project_confidence (project_id, confidence DESC)`
- `idx_memories_project_expires_at (project_id, expires_at)`

### 说明

这里不做版本表。V1 采用原地更新，但建议在应用层保留变更日志能力的扩展点，避免未来难以补历史。

---

## 5.4 `documents`

### 职责

承载稳定知识沉淀与外部文档索引。

### 建议字段

| 字段 | 类型 | 非空 | 默认值 | 说明 |
|---|---|---:|---|---|
| `id` | `TEXT` | 是 |  | 主键 |
| `project_id` | `TEXT` | 是 |  | 所属项目 |
| `user_id` | `TEXT` | 是 |  | 所属用户 |
| `document_type` | `TEXT` | 是 |  | 文档类型 |
| `source_type` | `TEXT` | 是 |  | 来源类型 |
| `source_uri` | `TEXT` | 否 | `NULL` | 外部地址或本地路径 |
| `title` | `TEXT` | 是 |  | 文档标题 |
| `slug` | `TEXT` | 否 | `NULL` | 文档 slug |
| `summary` | `TEXT` | 否 | `NULL` | 摘要 |
| `content_markdown` | `TEXT` | 否 | `NULL` | Markdown 内容 |
| `canonical_storage` | `TEXT` | 是 | `'database'` | 权威存储位置 |
| `status` | `TEXT` | 是 | `'active'` | 文档状态 |
| `last_synced_at` | `TEXT` | 否 | `NULL` | 最近同步时间 |
| `metadata_json` | `TEXT` | 否 | `NULL` | 扩展元数据 |
| `created_at` | `TEXT` | 是 |  | 创建时间 |
| `updated_at` | `TEXT` | 是 |  | 更新时间 |

### 约束

- `PRIMARY KEY (id)`
- `FOREIGN KEY (project_id) REFERENCES projects(id)`
- `CHECK (document_type IN ('note','summary','decision','guide','knowledge','external_index'))`
- `CHECK (source_type IN ('system_generated','obsidian','yuque','notion','manual','external'))`
- `CHECK (canonical_storage IN ('database','markdown','external'))`
- `CHECK (status IN ('active','stale','archived'))`

### 索引

- `idx_documents_project_user (project_id, user_id)`
- `idx_documents_project_type_status (project_id, document_type, status)`
- `idx_documents_project_slug (project_id, slug)`
- `idx_documents_project_source_uri (project_id, source_uri)`
- `idx_documents_project_updated_at (project_id, updated_at DESC)`

### 唯一性建议

- 若 `slug` 不为空，建议在应用层保证同一项目下唯一
- 若 `source_uri` 不为空，建议在应用层去重，避免重复登记同一外部文档

---

## 5.5 `entities`

### 职责

作为 recall 的轻量语义锚点，不承载复杂知识图谱推理。

### 建议字段

| 字段 | 类型 | 非空 | 默认值 | 说明 |
|---|---|---:|---|---|
| `id` | `TEXT` | 是 |  | 主键 |
| `project_id` | `TEXT` | 是 |  | 所属项目 |
| `entity_type` | `TEXT` | 是 |  | 实体类型 |
| `name` | `TEXT` | 是 |  | 原始名称 |
| `normalized_name` | `TEXT` | 是 |  | 归一化名称 |
| `description` | `TEXT` | 否 | `NULL` | 描述 |
| `aliases_json` | `TEXT` | 否 | `NULL` | 别名列表 |
| `metadata_json` | `TEXT` | 否 | `NULL` | 扩展信息 |
| `created_at` | `TEXT` | 是 |  | 创建时间 |
| `updated_at` | `TEXT` | 是 |  | 更新时间 |

### 约束

- `PRIMARY KEY (id)`
- `FOREIGN KEY (project_id) REFERENCES projects(id)`
- `CHECK (entity_type IN ('user','project','repo','file','service','api','tool','concept','task'))`
- `UNIQUE (project_id, entity_type, normalized_name)`

### 索引

- `idx_entities_project_type (project_id, entity_type)`
- `idx_entities_project_normalized_name (project_id, normalized_name)`

### 说明

`normalized_name` 建议统一做：

- trim
- lower-case
- 路径标准化（如 file / repo）

这样可以显著降低重复实体。

---

## 5.6 `feedback_signals`

### 职责

记录用户与系统对 memory / document / recall 的反馈信号，为强化、衰减、纠偏提供输入。

### 建议字段

| 字段 | 类型 | 非空 | 默认值 | 说明 |
|---|---|---:|---|---|
| `id` | `TEXT` | 是 |  | 主键 |
| `project_id` | `TEXT` | 是 |  | 所属项目 |
| `user_id` | `TEXT` | 是 |  | 所属用户 |
| `agent_id` | `TEXT` | 否 | `NULL` | 智能体标识 |
| `target_type` | `TEXT` | 是 |  | 目标类型 |
| `target_id` | `TEXT` | 是 |  | 目标 ID |
| `signal_type` | `TEXT` | 是 |  | 信号类型 |
| `signal_value` | `REAL` | 是 |  | 信号强度 |
| `reason` | `TEXT` | 否 | `NULL` | 原因 |
| `context_json` | `TEXT` | 否 | `NULL` | 反馈上下文 |
| `created_at` | `TEXT` | 是 |  | 创建时间 |

### 约束

- `PRIMARY KEY (id)`
- `FOREIGN KEY (project_id) REFERENCES projects(id)`
- `CHECK (target_type IN ('memory','document','recall_result'))`
- `CHECK (signal_type IN ('confirmed','rejected','used_successfully','used_unsuccessfully','retrieved','ignored','conflicted','merged'))`
- `CHECK (signal_value >= -1 AND signal_value <= 1)`

### 索引

- `idx_feedback_project_target (project_id, target_type, target_id)`
- `idx_feedback_project_created_at (project_id, created_at DESC)`
- `idx_feedback_project_user (project_id, user_id)`

### 说明

由于 `target_id` 指向的是多态目标，数据库层无法做标准外键，需由应用层做存在性校验。

---

## 6. 关系表设计

## 6.1 `event_entities`

### 职责

记录事件提及的实体。

### 字段

| 字段 | 类型 | 非空 | 说明 |
|---|---|---:|---|
| `event_id` | `TEXT` | 是 | 事件 ID |
| `entity_id` | `TEXT` | 是 | 实体 ID |
| `role` | `TEXT` | 否 | 实体在事件中的角色 |
| `created_at` | `TEXT` | 是 | 创建时间 |

### 约束

- `PRIMARY KEY (event_id, entity_id)`
- `FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE`
- `FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE`

### 索引

- `idx_event_entities_entity_id (entity_id)`

---

## 6.2 `memory_entities`

### 职责

记录记忆与实体的关联，是 recall 的高价值索引表。

### 字段

| 字段 | 类型 | 非空 | 说明 |
|---|---|---:|---|
| `memory_id` | `TEXT` | 是 | 记忆 ID |
| `entity_id` | `TEXT` | 是 | 实体 ID |
| `weight` | `REAL` | 是 | 关联强度 |
| `created_at` | `TEXT` | 是 | 创建时间 |

### 约束

- `PRIMARY KEY (memory_id, entity_id)`
- `FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE`
- `FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE`
- `CHECK (weight >= 0 AND weight <= 1)`

### 索引

- `idx_memory_entities_entity_id (entity_id)`
- `idx_memory_entities_entity_weight (entity_id, weight DESC)`

---

## 6.3 `document_entities`

### 职责

记录文档与实体关联，支撑文档追踪与知识整理。

### 字段

| 字段 | 类型 | 非空 | 说明 |
|---|---|---:|---|
| `document_id` | `TEXT` | 是 | 文档 ID |
| `entity_id` | `TEXT` | 是 | 实体 ID |
| `created_at` | `TEXT` | 是 | 创建时间 |

### 约束

- `PRIMARY KEY (document_id, entity_id)`
- `FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE`
- `FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE`

### 索引

- `idx_document_entities_entity_id (entity_id)`

---

## 6.4 `memory_links`

### 职责

记录记忆之间的支持、冲突、派生、替代关系。

### 字段

| 字段 | 类型 | 非空 | 说明 |
|---|---|---:|---|
| `from_memory_id` | `TEXT` | 是 | 起始记忆 |
| `to_memory_id` | `TEXT` | 是 | 目标记忆 |
| `link_type` | `TEXT` | 是 | 关系类型 |
| `weight` | `REAL` | 否 | 关系权重 |
| `created_at` | `TEXT` | 是 | 创建时间 |

### 约束

- `PRIMARY KEY (from_memory_id, to_memory_id, link_type)`
- `FOREIGN KEY (from_memory_id) REFERENCES memories(id) ON DELETE CASCADE`
- `FOREIGN KEY (to_memory_id) REFERENCES memories(id) ON DELETE CASCADE`
- `CHECK (from_memory_id <> to_memory_id)`
- `CHECK (link_type IN ('supports','conflicts','derived_from','supersedes','related_to'))`
- `CHECK (weight IS NULL OR (weight >= 0 AND weight <= 1))`

### 索引

- `idx_memory_links_to_memory_id (to_memory_id)`
- `idx_memory_links_link_type (link_type)`

---

## 6.5 `event_memory_links`

### 职责

记录记忆由哪些事件支撑，是 trace 功能的核心来源。

### 字段

| 字段 | 类型 | 非空 | 说明 |
|---|---|---:|---|
| `event_id` | `TEXT` | 是 | 证据事件 |
| `memory_id` | `TEXT` | 是 | 被支撑记忆 |
| `evidence_role` | `TEXT` | 否 | 证据角色，如 source / support / contradiction |
| `weight` | `REAL` | 否 | 证据权重 |
| `created_at` | `TEXT` | 是 | 创建时间 |

### 约束

- `PRIMARY KEY (event_id, memory_id)`
- `FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE`
- `FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE`
- `CHECK (weight IS NULL OR (weight >= 0 AND weight <= 1))`

### 索引

- `idx_event_memory_links_memory_id (memory_id)`

---

## 6.6 `memory_document_links`

### 职责

记录哪些记忆已经沉淀到哪些文档。

### 字段

| 字段 | 类型 | 非空 | 说明 |
|---|---|---:|---|
| `memory_id` | `TEXT` | 是 | 记忆 ID |
| `document_id` | `TEXT` | 是 | 文档 ID |
| `role` | `TEXT` | 否 | 角色，如 primary / supporting |
| `created_at` | `TEXT` | 是 | 创建时间 |

### 约束

- `PRIMARY KEY (memory_id, document_id)`
- `FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE`
- `FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE`

### 索引

- `idx_memory_document_links_document_id (document_id)`

---

## 7. 推荐建表顺序

为降低迁移失败概率，建议按以下顺序建表：

1. `projects`
2. `events`
3. `memories`
4. `documents`
5. `entities`
6. `feedback_signals`
7. `event_entities`
8. `memory_entities`
9. `document_entities`
10. `memory_links`
11. `event_memory_links`
12. `memory_document_links`

原因：

- 先主表，后关系表
- 先固定引用方向，后多对多映射
- 避免迁移中出现循环依赖感知问题

---

## 8. 查询与索引策略

### 8.1 Recall 主查询

Recall 典型查询路径：

1. 按 `project_id`、`user_id`、`scope_type` 初筛 memories
2. 按 `memory_type`、`status`、`expires_at` 过滤
3. 联查 `memory_entities` 命中相关实体
4. 根据 `strength`、`confidence`、`updated_at` 进行排序修正
5. 必要时回查 `event_memory_links` 获取证据
6. 必要时回查 `memory_document_links` 获取沉淀文档

因此，`memories`、`memory_entities`、`event_memory_links`、`memory_document_links` 的索引是 V1 性能关键。

### 8.2 Trace 主查询

Trace 典型查询路径：

1. `memory_id -> event_memory_links`
2. `memory_id -> memory_document_links`
3. `memory_id -> memory_links`

因此所有以 `memory_id` 为入口的映射表都必须建立反向索引。

### 8.3 文档整理查询

文档沉淀场景典型查询：

1. 找出高价值且未归档 memories
2. 联查关联 entities
3. 生成 document
4. 回写 `memory_document_links`

这意味着后续可能需要增加“待沉淀候选”视图，但 V1 不必预建。

---

## 9. 约束与应用层责任边界

以下能力更适合放在应用层，而不是 SQLite schema 层：

### 9.1 应用层负责

- JSON 字段结构校验
- 枚举兼容策略
- 多态目标存在性校验（如 `feedback_signals.target_id`）
- recall 排序分数计算
- memory 合并与冲突解决
- 文档内容生成
- 实体名称归一化

### 9.2 数据库层负责

- 基础存在性约束
- 唯一性约束
- 基本数值范围约束
- 关系表一致性
- 查询性能索引

这个分层符合 KISS 与 YAGNI：数据库负责底线正确性，复杂业务规则留在服务层。

---

## 10. V1 暂不引入的 Schema 能力

以下内容先明确不进入 V1：

- `users` 独立表
- `agents` 独立表
- `sessions` / `conversations` 表
- 全量变更历史表
- 向量表或 embedding 表
- 审计日志总表
- 大型全文检索扩展依赖
- 多租户隔离字段

这样可以控制 V1 复杂度，先把核心闭环做稳定。

---

## 11. 后续实现建议

从工程实现角度，下一步建议直接产出以下文件：

1. `docs/api.md`
   - 把 command / query 接口定义成实现契约

2. `src/db/schema/*`
   - 每张表一个 schema 文件
   - 关系表单独放 `links` 子目录

3. `src/db/mappers/*`
   - 负责 persistence model 和 domain model 转换

4. `src/repositories/*`
   - 按聚合根组织仓储访问

5. `tests/integration/db/*`
   - 针对 schema、索引、基础约束做集成测试

---

## 12. 总结

这份 schema 设计将架构文档中的“数据模型章节”推进到了可实现层，已经明确了：

- 表结构边界
- 字段类型
- 主键与唯一约束
- 关系设计
- 核心索引
- 数据库层与应用层职责边界

基于本文档，下一阶段已经可以开始写：

- SQLite migration
- ORM schema
- repository 接口
- 基础集成测试
