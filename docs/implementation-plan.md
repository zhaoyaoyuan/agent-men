# Memory OS V1 实现计划文档

- **文档类型**：开发计划 / 可执行实施计划
- **状态**：Draft
- **目标读者**：协作开发者、实现负责人、未来维护者
- **依赖文档**：`docs/architecture.md`、`docs/schema.md`、`docs/api.md`、`docs/recall-engine.md`
- **最后更新**：2026-03-27

---

## 1. 文档目标

本文档将已有架构与实现级设计文档收敛为可执行开发计划，用于直接指导 Memory OS V1 的工程落地。

重点解决以下问题：

1. 先做什么，后做什么
2. 每个阶段的产物是什么
3. 代码应该落到哪些目录和文件
4. 每阶段如何验证是否完成
5. 哪些风险点需要提前规避
6. 在不引入过度复杂度的前提下，如何尽快建立 V1 闭环

本文档不重复解释架构原理，而聚焦于 **执行顺序、产物边界、依赖关系、验证方式**。

---

## 2. 目标范围

## 2.1 V1 最终目标

交付一个本地优先、SQLite 驱动、面向多用户多项目、可供多智能体接入的 Memory OS 最小可用版本。

V1 的完成标准不是“功能很多”，而是以下闭环真正成立：

```text
event -> memory -> recall -> feedback -> document
```

## 2.2 V1 必须交付的能力

- 统一事件写入
- 核心记忆提炼
- 可解释 recall
- feedback 回流强化/衰减
- Markdown 文档沉淀
- 至少一种可工作的接入方式

## 2.3 V1 明确不纳入

- 多租户
- 分布式部署
- 高级 UI
- 重型向量检索
- 完整权限系统
- 复杂知识图谱推理
- 大量管理后台接口

---

## 3. 交付策略

## 3.1 总体策略

采用“先骨架、后闭环、再接入”的方式推进：

1. 先建立稳定工程骨架
2. 再打通最小核心链路
3. 然后补 feedback 与 document 沉淀
4. 最后做 adapter 与端到端验证

## 3.2 为什么这样排

原因很直接：

- 没有骨架，后面所有实现都会返工
- 没有 recall，系统就不具备核心价值
- 没有 feedback，系统不会进化
- 没有 document，系统就缺少长期知识沉淀
- 没有 adapter，系统无法被真实 agent 使用

## 3.3 执行原则

- 优先做系统闭环，而不是补边角能力
- 优先做可验证产物，而不是只写抽象层
- 优先单机可用，再考虑未来扩展点
- 严格避免为了“以后可能会用到”而提前引入复杂组件

这符合 KISS、YAGNI、渐进式演进原则。

---

## 4. 推荐工程目录落点

基于 `docs/architecture.md:946`，推荐第一版代码目录如下：

```text
memory-os/
├─ docs/
├─ data/
├─ src/
│  ├─ domain/
│  │  ├─ event/
│  │  ├─ memory/
│  │  ├─ document/
│  │  ├─ feedback/
│  │  └─ recall/
│  ├─ db/
│  │  ├─ schema/
│  │  ├─ migrations/
│  │  ├─ mappers/
│  │  └─ client/
│  ├─ repositories/
│  ├─ services/
│  ├─ adapters/
│  │  ├─ sdk/
│  │  ├─ cli/
│  │  ├─ skill/
│  │  └─ mcp/
│  ├─ config/
│  └─ shared/
├─ scripts/
└─ tests/
   ├─ unit/
   ├─ integration/
   └─ e2e/
```

### 目录职责

- `domain/`：领域类型、值对象、接口定义
- `db/schema/`：表定义
- `db/migrations/`：迁移脚本
- `db/mappers/`：persistence model <-> domain model 转换
- `repositories/`：数据库访问抽象
- `services/`：业务核心逻辑
- `adapters/`：对外接入层
- `tests/`：测试分层

---

## 5. 分阶段计划总览

## 5.1 阶段划分

| 阶段 | 名称 | 核心目标 |
|---|---|---|
| 0 | 工程骨架 | 让项目具备可开发、可测试、可迁移基础 |
| 1 | 事件接入层 | 建立统一原始输入入口 |
| 2 | 记忆抽取层 | 从事件生成核心记忆 |
| 3 | Recall 引擎 | 让系统具备核心读取价值 |
| 4 | Feedback 强化层 | 让系统具备纠偏与进化能力 |
| 5 | 文档沉淀层 | 形成长期知识资产 |
| 6 | 接入与验证 | 让真实智能体可接入并完成闭环验证 |

## 5.2 关键依赖关系

```text
阶段0 -> 阶段1 -> 阶段2 -> 阶段3 -> 阶段4 -> 阶段5 -> 阶段6
```

说明：

- 阶段 3 依赖 1 和 2
- 阶段 4 依赖 3
- 阶段 5 依赖 2 和 3
- 阶段 6 依赖前面全部最小能力完成

---

## 6. 阶段 0：工程骨架

## 6.1 目标

建立基础 TypeScript 工程、SQLite 连接、迁移机制、配置系统与错误系统。

## 6.2 主要产物

### 文档产物

- 已有文档作为输入，无新增设计文档硬要求

### 代码产物

建议最小文件集：

```text
src/config/env.ts
src/config/project-settings.ts
src/shared/errors.ts
src/shared/result.ts
src/shared/types.ts
src/db/client/sqlite.ts
src/db/migrations/
src/db/schema/
```

## 6.3 工作项

1. 初始化 TypeScript 工程
2. 选定运行时（Node.js 或 Bun）
3. 选定 SQLite 访问方式（Drizzle 或 Kysely）
4. 建立 migration 基础设施
5. 建立统一错误模型
6. 建立基础测试命令
7. 建立 lint / format / typecheck 基线

## 6.4 验收标准

- 本地可运行 `typecheck`
- SQLite 可连接
- 空 migration 可执行
- 基础配置可加载
- 单元测试框架可运行

## 6.5 风险点

- 工具链选型过重
- 过早抽象 repository 泛型框架
- 迁移机制未定导致后续 schema 落不下去

---

## 7. 阶段 1：事件接入层

## 7.1 目标

让任意客户端能够把统一格式事件写入系统。

## 7.2 主要产物

### Schema / DB

- `projects`
- `events`

### 代码建议落点

```text
src/domain/event/types.ts
src/domain/event/contracts.ts
src/db/schema/projects.ts
src/db/schema/events.ts
src/db/mappers/event-mapper.ts
src/repositories/project-repository.ts
src/repositories/event-repository.ts
src/services/ingest-event-service.ts
```

## 7.3 工作项

1. 建立 `projects` / `events` 表
2. 定义 `IngestEventInput` 领域类型
3. 实现事件输入校验
4. 实现事件写入
5. 实现基础去重 / 幂等策略
6. 写入 `projectId + userId + scope` 的隔离逻辑

## 7.4 验收标准

- `ingestEvent` 可正常落库
- 重复事件不会无限膨胀
- 非法输入能返回结构化错误
- 不同项目数据互不串扰

## 7.5 测试重点

- 事件入库成功
- 幂等 key 生效
- score 越界报错
- scope 非法报错
- 项目不存在时报 `NOT_FOUND`

---

## 8. 阶段 2：记忆抽取层

## 8.1 目标

把原始事件转成五类核心记忆，并建立事件到记忆的证据链路。

## 8.2 主要产物

### Schema / DB

- `memories`
- `event_memory_links`

### 代码建议落点

```text
src/domain/memory/types.ts
src/domain/memory/contracts.ts
src/db/schema/memories.ts
src/db/schema/event-memory-links.ts
src/db/mappers/memory-mapper.ts
src/repositories/memory-repository.ts
src/repositories/event-memory-link-repository.ts
src/services/extract-memories-service.ts
src/services/memory-extraction/
```

## 8.3 工作项

1. 建立 `memories` 与 `event_memory_links`
2. 定义 Memory 领域模型
3. 建立五类核心记忆提炼规则：
   - fact
   - preference
   - constraint
   - task_state
   - experience
4. 实现 merge / skip / update 策略
5. 建立 event -> memory 证据映射

## 8.4 验收标准

- 给定事件批次能产出至少一类正确 memory
- 重复事件不会导致明显重复 memory 膨胀
- `created / updated / skipped` 结果可解释
- event 与 memory 的链路可追踪

## 8.5 测试重点

- 单事件提炼
- 多事件提炼
- 相似记忆合并
- overwrite / merge 策略差异
- evidence link 正确生成

---

## 9. 阶段 3：Recall 引擎

## 9.1 目标

让系统具备最核心价值：能按当前任务上下文召回最有帮助的记忆。

## 9.2 主要产物

### Schema / DB

- `entities`
- `memory_entities`
- 可选：`memory_links`（若本阶段需要最小冲突关系）

### 代码建议落点

```text
src/domain/recall/types.ts
src/domain/recall/contracts.ts
src/db/schema/entities.ts
src/db/schema/memory-entities.ts
src/repositories/entity-repository.ts
src/repositories/memory-entity-repository.ts
src/services/recall/normalize-input.ts
src/services/recall/build-candidates.ts
src/services/recall/score-memories.ts
src/services/recall/filter-results.ts
src/services/recall/build-packet.ts
src/services/recall/recall-memories-service.ts
```

## 9.3 工作项

1. 建立 `entities` 与 `memory_entities`
2. 实现输入标准化
3. 实现候选池初筛
4. 实现实体增强
5. 实现四因子排序
6. 实现 explainability 组装
7. 实现 memory packet 分组
8. 实现 recall 弱回写

## 9.4 验收标准

- `recallMemories` 能返回合理的 `items + packet`
- explainability 可开关
- evidence / documents 可裁剪
- 约束类和任务状态类记忆不会被普通事实完全淹没
- packet 分组结构稳定

## 9.5 测试重点

- 多 memory_type 分组
- 不同 scope 过滤
- feedback 前基础排序可解释
- expired / invalidated memory 排除
- entities 增强生效

---

## 10. 阶段 4：Feedback 强化层

## 10.1 目标

让 recall 不是静态检索，而能根据使用结果逐步强化、衰减和纠偏。

## 10.2 主要产物

### Schema / DB

- `feedback_signals`
- 可选补齐：`memory_links`

### 代码建议落点

```text
src/domain/feedback/types.ts
src/domain/feedback/contracts.ts
src/db/schema/feedback-signals.ts
src/db/schema/memory-links.ts
src/repositories/feedback-repository.ts
src/repositories/memory-link-repository.ts
src/services/submit-feedback-service.ts
src/services/feedback/apply-feedback.ts
```

## 10.3 工作项

1. 建立 feedback 表
2. 实现 `submitFeedback`
3. 建立正反馈与负反馈映射策略
4. 更新 `strength / decayScore / successCount / failureCount`
5. 必要时引入 `cooling / invalidated` 状态迁移
6. 让 recall 读取反馈结果并体现排序变化

## 10.4 验收标准

- feedback 能成功落库
- 同一记忆在 feedback 前后 recall 顺序发生合理变化
- `rejected` / `conflicted` 能触发明显降权
- `confirmed` / `used_successfully` 能触发增强

## 10.5 测试重点

- 正反馈增强
- 负反馈衰减
- ignored 弱反馈
- 状态迁移规则
- recall 前后排序对比

---

## 11. 阶段 5：文档沉淀层

## 11.1 目标

把稳定、高价值记忆沉淀成长期知识资产，补齐类人记忆中的“外部知识库”部分。

## 11.2 主要产物

### Schema / DB

- `documents`
- `memory_document_links`
- `document_entities`

### 代码建议落点

```text
src/domain/document/types.ts
src/domain/document/contracts.ts
src/db/schema/documents.ts
src/db/schema/memory-document-links.ts
src/db/schema/document-entities.ts
src/repositories/document-repository.ts
src/repositories/memory-document-link-repository.ts
src/services/consolidate-document-service.ts
src/services/document/render-markdown.ts
```

## 11.3 工作项

1. 建立文档相关表
2. 实现 `consolidateDocument`
3. 生成 Markdown 内容
4. 建立 memory -> document 映射
5. 支持外部文档登记模式
6. 将已沉淀文档纳入 recall supporting documents

## 11.4 验收标准

- 能将一组 memory 成功沉淀为 document
- Markdown 输出可读
- `memory_document_links` 正确写入
- recall 能返回 supporting documents

## 11.5 测试重点

- 新建文档
- 更新文档
- registerExternalOnly 模式
- supporting documents 回填
- document 与 entity 关联

---

## 12. 阶段 6：接入与验证

## 12.1 目标

让 Memory OS 真正被外部智能体调用，并验证闭环在真实使用链路中成立。

## 12.2 主要产物

### 代码建议落点

```text
src/adapters/sdk/
src/adapters/cli/
src/adapters/skill/
src/adapters/mcp/   # 可选
examples/
```

## 12.3 工作项

1. 建立 SDK facade
2. 建立 CLI adapter
3. 建立最小 skill adapter
4. 用一个示例项目跑通闭环：
   - recall
   - ingest
   - extract
   - feedback
   - document
5. 编写端到端测试

## 12.4 验收标准

- 至少一种接入方式可真实调用全部核心链路
- 示例项目可完成闭环演示
- 文档与代码行为一致
- 无明显跨项目污染或状态错乱

## 12.5 测试重点

- SDK 调用路径
- CLI 调用路径
- 闭环端到端链路
- packet 输出稳定性
- feedback 对后续 recall 的影响

---

## 13. 阶段间依赖与并行策略

## 13.1 必须串行的部分

以下部分必须按顺序推进：

- 阶段 0 -> 阶段 1
- 阶段 1 -> 阶段 2
- 阶段 2 -> 阶段 3
- 阶段 3 -> 阶段 4

## 13.2 可部分并行的部分

在条件满足时，可以并行推进：

- 阶段 5 文档沉淀层可在阶段 4 后半段启动
- 阶段 6 的 adapter 壳层可在阶段 3 稳定后先搭骨架
- 测试脚手架可以从阶段 0 就并行铺设

## 13.3 为什么不能过早并行

因为 Memory OS 的核心耦合点在：

- memory 结构
- recall 返回结构
- feedback 对 recall 的影响

这些没稳定前，过早并行会导致 adapter 和测试大量返工。

---

## 14. 文件级落点建议

下面给出第一批最值得创建的代码文件：

## 14.1 第一批（阶段 0-1）

```text
src/shared/errors.ts
src/shared/result.ts
src/shared/types.ts
src/config/env.ts
src/db/client/sqlite.ts
src/db/schema/projects.ts
src/db/schema/events.ts
src/repositories/project-repository.ts
src/repositories/event-repository.ts
src/services/ingest-event-service.ts
```

## 14.2 第二批（阶段 2-3）

```text
src/db/schema/memories.ts
src/db/schema/event-memory-links.ts
src/db/schema/entities.ts
src/db/schema/memory-entities.ts
src/services/extract-memories-service.ts
src/services/recall/recall-memories-service.ts
src/services/recall/build-candidates.ts
src/services/recall/score-memories.ts
src/services/recall/build-packet.ts
```

## 14.3 第三批（阶段 4-6）

```text
src/db/schema/feedback-signals.ts
src/db/schema/documents.ts
src/db/schema/memory-document-links.ts
src/services/submit-feedback-service.ts
src/services/consolidate-document-service.ts
src/adapters/sdk/index.ts
src/adapters/cli/index.ts
src/adapters/skill/index.ts
```

这样拆分符合单一职责，也避免大文件过早膨胀。

---

## 15. 测试策略

## 15.1 测试分层

### 单元测试

验证：

- 输入校验
- 排序函数
- packet 组装
- feedback 映射
- mapper 转换

### 集成测试

验证：

- SQLite schema / migrations
- repository 读写
- recall 查询链路
- consolidate document 链路

### 端到端测试

验证：

- 接入层调用
- 闭环链路
- 跨阶段行为一致性

## 15.2 最低保障测试集

V1 最低必须有以下测试：

1. `ingestEvent` 成功与幂等
2. `extractMemories` 生成核心记忆
3. `recallMemories` 返回 packet
4. `submitFeedback` 改变 recall 排序
5. `consolidateDocument` 输出 Markdown
6. 一个真实闭环 E2E

## 15.3 覆盖率要求

按全局规则，目标覆盖率至少 **80%**，但注意：

- 不要为覆盖率写无价值测试
- 优先覆盖 recall、feedback、mapper、repository 这些高风险点

---

## 16. 风险与缓解策略

## 16.1 Recall 效果不稳定

### 风险

规则排序不足，结果看起来像普通检索。

### 缓解

- 先做固定样本回归集
- 把 explainability 做扎实
- 允许项目级权重配置

## 16.2 自动提炼噪声过高

### 风险

memory 膨胀，召回质量快速下降。

### 缓解

- 初期提高提炼门槛
- 先支持 `skipped` 明确原因
- 默认限制 extract 范围与类型

## 16.3 反馈逻辑破坏 recall 稳定性

### 风险

少量错误反馈导致排序失真。

### 缓解

- 正负反馈影响做上限控制
- `ignored` 作为弱信号
- 严重状态迁移要有阈值

## 16.4 文档沉淀质量差

### 风险

输出文档可读性差，无法发挥“外部知识库”价值。

### 缓解

- 优先保证结构清晰
- 先做简洁模板
- 不在 V1 追求复杂自动写作能力

## 16.5 过早抽象

### 风险

代码层过度设计，开发变慢。

### 缓解

- 先围绕当前 6 个核心接口实现
- repository 不做过度泛型抽象
- adapter 只做薄壳

---

## 17. 里程碑定义

## 里程碑 M1：事件与记忆可落库

完成条件：

- 阶段 0、1、2 完成
- 事件与记忆链路可追踪

## 里程碑 M2：Recall 可用

完成条件：

- 阶段 3 完成
- 能返回可解释 packet

## 里程碑 M3：系统可进化

完成条件：

- 阶段 4 完成
- feedback 对 recall 有实际影响

## 里程碑 M4：长期知识闭环成立

完成条件：

- 阶段 5 完成
- memory 可沉淀为 document

## 里程碑 M5：真实接入可验证

完成条件：

- 阶段 6 完成
- 至少一个外部 agent 场景跑通

---

## 18. 每阶段完成定义

如果要严格控制“什么叫完成”，建议每阶段满足以下四项：

1. 代码已实现
2. 测试已通过
3. 文档已同步
4. 可以用一句话演示该阶段价值

例如：

- 阶段 1："我可以把 Claude 的一条事件稳定写入 Memory OS。"
- 阶段 3："我可以基于当前任务召回一组可解释的关键记忆。"
- 阶段 5："我可以把稳定记忆沉淀成 Markdown 知识文档。"

---

## 19. 推荐实施顺序（最小可行执行版）

如果只按最小成本推进，我建议实际执行顺序如下：

1. 阶段 0 全部完成
2. 阶段 1 只做 `projects + events + ingestEvent`
3. 阶段 2 先只做 `fact / constraint / task_state`
4. 阶段 3 先做无 entities 的基础 recall
5. 补 `entities + memory_entities`
6. 补 feedback
7. 补 document consolidation
8. 最后做 adapter 与 E2E

理由：

- 先把闭环跑通，再追求 recall 质量上限
- 先覆盖高价值 memory type，再补 preference / experience
- 先有基础 recall，再叠加实体增强

这能最大程度避免一开始就把系统做重。

---

## 20. 总结

这份实现计划已经把设计文档收敛成可执行工程路线，明确了：

- 阶段拆分
- 文件级落点
- 依赖顺序
- 测试策略
- 风险控制
- 里程碑标准

到这里，Memory OS V1 的文档层已经基本完整，下一步最合理的动作不再是继续抽象文档，而是：

1. 开始生成第一批代码骨架
2. 从阶段 0 / 阶段 1 按计划执行
3. 用测试驱动把闭环一点点跑起来
