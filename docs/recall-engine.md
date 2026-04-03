# Memory OS Recall Engine 设计文档

- **文档类型**：实现级召回引擎设计
- **状态**：Draft
- **目标读者**：协作开发者、召回引擎实现者、排序策略维护者
- **依赖文档**：`docs/architecture.md`、`docs/schema.md`、`docs/api.md`
- **最后更新**：2026-03-27

---

## 1. 文档目标

本文档将 `docs/architecture.md` 中“召回与反馈机制”章节进一步细化为可实现的召回引擎设计。

目标是回答以下问题：

1. recall 从哪些数据源读取
2. recall 的处理流水线如何组织
3. 四因子排序如何落地
4. explainability 如何生成
5. feedback 如何回流影响后续 recall
6. memory packet 如何从候选记忆组装出来
7. V1 如何在准确性、可解释性、性能之间取得平衡

本文档只覆盖 **V1 规则驱动的 recall engine**，不引入重型向量基础设施，不要求外部搜索服务。

---

## 2. 设计目标与边界

## 2.1 设计目标

Recall 的目标不是“找最像的文本”，而是：

> 在当前任务上下文下，让智能体想起最值得想起、最可靠、最能帮助当前决策的记忆。

V1 需要同时满足：

- **可用**：结果对任务真实有帮助
- **可解释**：能说明为什么命中这条记忆
- **可控**：能通过 options 和 project settings 调整
- **可演进**：后续可以接入 embedding / rerank 而不推翻接口

## 2.2 V1 边界

V1 明确不做：

- 复杂向量索引集群
- 在线学习模型排序器
- 大规模全文检索服务依赖
- 复杂知识图谱推理
- 黑盒神经 reranker 强绑定

V1 采用：

- SQLite + 规则排序
- 轻量文本匹配
- 实体关联增强
- feedback 驱动强化与衰减

---

## 3. Recall 在系统中的位置

Recall 位于 Memory Core Layer，是从 Memory OS 中读出结构化认知的核心路径。

典型调用链：

```text
Agent 请求上下文
  -> recallMemories(query, context, options)
  -> 召回候选 memories
  -> 排序与过滤
  -> 组装 memory packet
  -> 注入 agent 上下文
  -> agent 执行任务
  -> 后续 submitFeedback 回流影响下一次 recall
```

因此 recall 不是单次静态检索，而是闭环系统中的中枢读路径。

---

## 4. 输入与输出

## 4.1 输入

Recall 直接复用 `docs/api.md` 中的 `RecallMemoryInput`：

```ts
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
```

其中几个关键字段的实际作用如下：

- `query`：主查询文本，是语义匹配基础
- `scope`：限制 recall 的逻辑适用范围
- `context.currentTask`：补足任务目标语义
- `context.activeEntities`：给实体增强层提供线索
- `context.sourceType`：允许做轻度来源偏置
- `options`：控制过滤、解释性、返回裁剪

## 4.2 输出

Recall 返回两层结果：

1. **候选层**：`items`
   - 面向调试、解释、审计
2. **消费层**：`packet`
   - 面向 agent 直接消费

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
```

---

## 5. 数据来源

Recall 依赖以下核心数据源：

### 5.1 `memories`

主候选池。Recall 的大部分排序对象来自此表。

关键字段：

- `memory_type`
- `status`
- `confidence`
- `strength`
- `decay_score`
- `importance_score`
- `last_accessed_at`
- `last_reinforced_at`
- `expires_at`
- `updated_at`

### 5.2 `memory_entities`

用于实体相关性增强。

当 query 或 context 中包含实体线索时，通过该表提高上下文化召回质量。

### 5.3 `entities`

用于实体归一化与命中扩展。

### 5.4 `event_memory_links`

用于生成 evidence 追踪，不直接参与主排序，但参与可靠性与解释性构造。

### 5.5 `feedback_signals`

用于动态修正记忆权重与可靠性判断。

### 5.6 `memory_document_links` / `documents`

用于返回 supporting documents，以及增强“这条记忆是否已经沉淀”为长期知识的判断。

---

## 6. Recall 流水线

V1 Recall 推荐实现为 8 步流水线：

```text
1. 输入标准化
2. 候选池初筛
3. 实体提取与实体增强
4. 四因子打分
5. 过滤与截断
6. explainability 组装
7. memory packet 组装
8. 访问回写与弱反馈记录
```

下面逐步展开。

---

## 7. 第一步：输入标准化

## 7.1 query 标准化

对 `query` 做轻量清洗：

- trim 空白
- 合并重复空格
- lowercase（仅用于匹配，不改原文展示）
- 去除低价值噪声词的影响

注意：V1 不要求做复杂 NLP 分词，但应保留后续替换为 tokenizer 的扩展点。

## 7.2 context 标准化

对 `context.currentTask` 与 `context.activeEntities` 做统一格式处理：

- 空值转 `undefined`
- entity 名称归一化
- 去重

## 7.3 scope 标准化

若用户未显式传入 `scope`，使用默认策略：

1. 优先 `user_project`
2. 其次 `project`
3. 不默认扩大到 `global`

这样可以防止 recall 范围过大导致噪声上升。

---

## 8. 第二步：候选池初筛

初筛目标是用廉价规则迅速缩小候选范围。

## 8.1 基础过滤条件

默认过滤掉以下记忆：

- `status = 'invalidated'`
- 已过期 `expires_at < now`
- 明显不属于当前 `projectId`
- 不匹配当前 `scope` 的记录

## 8.2 可选过滤条件

由 `options` 控制：

- `memoryTypes`
- `minConfidence`
- `minStrength`

## 8.3 候选上限建议

V1 可以采用两段式候选池：

- **粗候选池**：最多 100~300 条
- **最终返回池**：默认 10 条以内

这样可以兼顾性能与排序稳定性。

## 8.4 初筛查询策略

推荐查询路径：

1. 从 `memories` 读取满足 `project_id + user_id + scope + status` 的记录
2. 利用 `memory_type`、`confidence`、`strength` 过滤
3. 预按 `updated_at DESC` 或 `strength DESC` 做一轮粗排序
4. 限制粗候选池规模

---

## 9. 第三步：实体提取与实体增强

实体增强是 V1 提高情境相关性的关键，不依赖向量也能显著提升效果。

## 9.1 实体来源

实体线索来源于：

- `context.activeEntities`
- `query`
- `currentTask`

## 9.2 实体匹配策略

V1 推荐采用轻量规则：

1. 精确匹配 `normalized_name`
2. 别名匹配 `aliases_json`
3. 路径/文件名标准化匹配
4. 对 repo / file / api / task 做更强偏置

## 9.3 实体增强方式

命中实体后，通过 `memory_entities` 获取相关 memories，并为其增加上下文分。

增强分不应单独决定最终排序，而应作为四因子之一的一部分。

## 9.4 设计原则

- 实体增强是“加分项”，不是“硬筛选项”
- 不能因为 query 中出现一个 file 名就把高价值通用约束完全压掉
- 多实体同时命中时，加权应有上限，避免过拟合局部上下文

---

## 10. 第四步：四因子打分

V1 的核心排序模型为四因子排序：

1. 情境相关性
2. 语义相关性
3. 强度与新近性
4. 证据可靠性 / 反馈信号

建议总分统一归一到 `0 ~ 1`。

```text
total_score =
  w_context * context_score +
  w_semantic * semantic_score +
  w_strength * strength_score +
  w_reliability * reliability_score
```

V1 默认不把权重写死到代码常量中，建议允许项目级配置覆盖。

## 10.1 情境相关性 `context_score`

反映这条记忆与当前任务上下文是否“场景一致”。

### 主要信号

- scope 是否匹配
- activeEntities 是否命中
- currentTask 是否与 memory title / summary / metadata 接近
- sourceType 是否存在轻度偏置

### 直觉

如果当前任务在改 `repo/file/api`，而这条记忆也与该实体强相关，则情境分更高。

## 10.2 语义相关性 `semantic_score`

反映 query 文本与 memory 内容是否相关。

### V1 建议做法

采用轻量文本匹配组合：

- 标题匹配
- summary 匹配
- content 关键词命中
- query 与 memory type 的语义偏置

### 注意

V1 不要求复杂 embedding，但要把语义匹配接口抽象出来，便于后续替换为向量检索或 rerank。

## 10.3 强度与新近性 `strength_score`

反映记忆的“活性”。

### 输入信号

- `strength`
- `decay_score`
- `importance_score`
- `last_accessed_at`
- `last_reinforced_at`
- `updated_at`

### 计算原则

- 强度越高越加分
- 衰减越高越减分
- 最近被访问/强化的记忆适度加分
- 重要度高的长期约束不应因为时间旧而被完全压低

因此新近性只能作为修正项，不能凌驾于约束类高价值记忆之上。

## 10.4 证据可靠性 `reliability_score`

反映这条记忆值不值得信。

### 输入信号

- `confidence`
- `success_count`
- `failure_count`
- 支撑事件数量
- 是否已沉淀为 document
- 是否存在 conflict / rejected feedback

### 计算原则

- 被多次成功使用的记忆更可靠
- 被确认过的记忆更可靠
- 被冲突/否定过的记忆可靠性下降
- 已沉淀文档的记忆可获得轻度可靠性提升，但不是绝对加成

---

## 11. 默认权重建议

V1 可使用如下默认权重作为起点：

| 因子 | 权重 |
|---|---:|
| 情境相关性 | 0.35 |
| 语义相关性 | 0.30 |
| 强度与新近性 | 0.20 |
| 证据可靠性 | 0.15 |

推荐理由：

- 当前任务上下文最重要
- 语义相关性次之
- 强度/新近性重要但不能主导
- 可靠性必须参与，但不应让系统变成保守到只认旧知识

项目级可覆盖，但应限制权重总和为 1。

---

## 12. 第五步：过滤与截断

排序完成后，需要进一步控制噪声。

## 12.1 过滤规则

### 硬过滤

直接排除：

- `status = invalidated`
- `total_score < min_threshold`
- 不满足 `minConfidence`
- 不满足 `minStrength`

### 软过滤

作为降权而非删除：

- `cooling` 状态
- 高 `decay_score`
- 存在 conflict link
- 最近失败使用较多

## 12.2 多样性控制

为了防止返回结果高度重复，建议加入轻量去冗余：

- 相似标题/summary 的 memory 不要连续占满前 N 名
- 同一事件派生出的多条高度重复记忆可只保留一条主记忆
- 同一 document 已沉淀的多条 supporting memory 可以适度压缩

## 12.3 最终截断

默认最终返回 `limit=10`，但组装 `packet` 时不一定全部进入同一分组。

---

## 13. 第六步：Explainability 组装

Explainability 是 V1 的关键卖点之一，不是调试附属信息。

## 13.1 最小解释要求

每条 recall item 至少应能回答：

1. 为什么命中它
2. 它主要靠哪个因子得分
3. 是否有证据事件
4. 是否有关联文档

## 13.2 解释结构

可复用 `MemoryExplanation`：

```ts
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
```

## 13.3 `reasonSummary` 生成建议

示例：

- “命中当前 repo 与 file 实体，且该记忆近期被成功使用。”
- “与当前任务语义高度相关，并由多个事件共同支撑。”
- “这是当前项目下高强度约束类记忆，虽然较早创建，但仍保持高可靠性。”

## 13.4 裁剪规则

- `includeExplanation=false`：不返回 explanation
- `includeEvidence=false`：返回理由摘要，但不返回 event IDs
- `includeDocuments=false`：不回填 related documents

---

## 14. 第七步：Memory Packet 组装

Recall 不直接把 top N 原样塞给 agent，而要组装成更稳定、更可消费的 `MemoryPacket`。

## 14.1 目标

让 agent 一眼区分：

- 事实
- 约束
- 偏好
- 任务状态
- 经验
- 文档支撑

这比返回一堆混杂条目更适合模型消费。

## 14.2 分组规则

根据 `memory_type` 进入不同槽位：

- `fact -> activeFacts`
- `constraint -> constraints`
- `preference -> preferences`
- `task_state -> taskState`
- `experience -> experiences`

## 14.3 槽位上限建议

V1 建议每个槽位设局部上限，避免单类记忆淹没上下文：

| 槽位 | 建议上限 |
|---|---:|
| `activeFacts` | 3 |
| `constraints` | 3 |
| `preferences` | 2 |
| `taskState` | 3 |
| `experiences` | 2 |
| `supportingDocuments` | 3 |

## 14.4 组装原则

- 高分不等于一定进入 packet，需考虑类型平衡
- 约束类与任务状态类优先级通常高于普通事实
- supporting documents 只放少量高价值文档，避免把 packet 变成文档列表

## 14.5 trace 字段

`packet.trace` 应仅保留最小必要追踪信息：

- `memoryId`
- `evidenceEventIds`
- `documentIds`

这样既支持追溯，也不会让主响应过重。

---

## 15. 第八步：访问回写与弱反馈

Recall 完成后，系统可以做最小回写，但不能把读取路径变成高风险写路径。

## 15.1 建议回写内容

- 更新命中 memory 的 `access_count`
- 更新 `last_accessed_at`
- 可选记录 `retrieved` 类型 feedback

## 15.2 回写原则

- 不应阻塞主 recall 返回
- 可异步执行
- 回写失败不影响 recall 成功响应

这是典型的弱反馈，不应污染主事务。

---

## 16. Feedback 回流机制

Feedback 是 recall 持续改善的核心来源。

## 16.1 正反馈

以下反馈会提升后续 recall 排序：

- `confirmed`
- `used_successfully`
- 多次 `retrieved` 且后续未被否定

### 建议影响

- 提高 `strength`
- 更新 `success_count`
- 适度提升 `confidence`
- 更新 `last_reinforced_at`

## 16.2 负反馈

以下反馈会降低后续 recall 排序：

- `rejected`
- `used_unsuccessfully`
- `conflicted`

### 建议影响

- 提高 `failure_count`
- 提高 `decay_score`
- 降低 `strength`
- 必要时状态降为 `cooling`
- 严重冲突时转为 `invalidated`

## 16.3 弱负反馈

- `ignored`

不应立即判定记忆错误，但可以作为长期降权信号。

## 16.4 文档沉淀反馈

当 memory 被成功沉淀为稳定文档后，可给予轻度正向加权：

- 提高 reliability 修正项
- 增加“长期知识”信号

但这不应覆盖当前任务上下文的需要。

---

## 17. 遗忘与衰减策略

V1 不直接物理删除记忆，而采用渐进式遗忘。

## 17.1 状态演进建议

```text
active -> cooling -> invalidated -> archived
```

## 17.2 衰减来源

- 长期未被召回
- 召回后连续使用失败
- 与新证据冲突
- 被更新记忆替代

## 17.3 设计原则

- 遗忘是可逆的，至少在 `cooling` 阶段应可重新激活
- `invalidated` 表示当前不可信，不代表历史不存在
- archive 更像长期存档，而不是删除

---

## 18. 配置项建议

Recall 引擎建议暴露以下项目级配置：

```ts
export interface RecallEngineSettings {
  defaultLimit: number
  minScoreThreshold: number
  weights: {
    context: number
    semantic: number
    strength: number
    reliability: number
  }
  packetLimits: {
    activeFacts: number
    constraints: number
    preferences: number
    taskState: number
    experiences: number
    supportingDocuments: number
  }
  includeExplanationByDefault: boolean
  includeEvidenceByDefault: boolean
  includeDocumentsByDefault: boolean
}
```

## 18.1 配置原则

- 对外暴露的是稳定配置项，不暴露内部实现细节
- 允许项目级覆盖，不鼓励每次调用都胡乱调权重
- 权重配置应有合法性校验

---

## 19. 性能策略

V1 在性能上的核心原则是：

> 先通过候选池控制和索引设计保证“够快”，而不是过早引入复杂基础设施。

## 19.1 性能关键点

- `memories` 初筛必须走索引
- `memory_entities` 只在有实体线索时参与
- evidence / documents 默认按需返回
- trace 信息避免默认展开全文

## 19.2 推荐优化顺序

1. 优化 SQL 查询和索引
2. 限制候选池规模
3. 做缓存或热数据优化
4. 最后再考虑 embedding / rerank

这个顺序符合 KISS 和 YAGNI。

---

## 20. 失败与降级策略

Recall 必须具备韧性，不能因为局部能力失效就整个不可用。

## 20.1 可降级场景

- 实体提取失败 -> 退化为纯文本 recall
- documents 查询失败 -> 仍返回 memories
- evidence 聚合失败 -> 仍返回基础 explanation
- 弱反馈回写失败 -> 不影响主流程

## 20.2 不可降级场景

- `projectId` 不存在
- 基础 memories 查询失败
- 输入非法

这些情况应直接返回结构化错误。

---

## 21. 测试建议

## 21.1 单元测试

覆盖：

- 四因子打分函数
- 权重归一化
- 过滤规则
- packet 分组逻辑
- explanation 裁剪逻辑

## 21.2 集成测试

覆盖：

- `recallMemories` 在多种 memory_type 下的分组结果
- 同一 query 下 feedback 前后排序变化
- scope 过滤正确性
- expired / invalidated memory 排除规则
- supporting documents 返回逻辑

## 21.3 回归测试

构造固定样本集，确保：

- 某些核心约束类记忆不会因时间旧而意外消失
- 重复事实不会挤占 packet
- 被拒绝记忆不会长期稳定排在前列

---

## 22. 后续演进方向

V1 之后，Recall Engine 可以演进但不需要推翻当前结构：

1. 接入 embedding 检索作为 `semantic_score` 子模块
2. 接入 rerank 模型替代部分规则排序
3. 增加时间上下文感知
4. 增加 task template 级 recall profile
5. 增加项目级“记忆卫生”任务，定期清理 cooling / invalidated 数据

这说明当前设计是可进化的，而不是一次性脚手架。

---

## 23. 总结

这份文档把 Recall 从架构层概念推进到了实现层规则：

- 明确了 recall 的输入输出
- 明确了候选筛选与实体增强
- 明确了四因子排序模型
- 明确了 explainability 的生成方式
- 明确了 feedback 如何反向影响 recall
- 明确了 memory packet 的组装规则
- 明确了降级与性能策略

基于本文档，下一阶段已经可以继续产出：

- `docs/implementation-plan.md`
- `src/services/recall/*` 代码骨架
- recall 排序与 packet 组装的单元测试设计
