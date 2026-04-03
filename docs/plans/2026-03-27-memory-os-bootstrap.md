# Memory OS Bootstrap 实现计划

> **给 Claude：** 必需的子技能：使用 executing-plans 逐任务实现此计划。

**目标：** 为 Memory OS V1 搭建第一批可运行代码骨架，优先打通工程骨架、SQLite 基础设施、`projects/events` schema，以及 `ingestEvent` 最小闭环。

**架构：** 采用本地优先、TypeScript 分层结构。先建立 shared/config/db 基础设施，再实现事件领域类型、schema、repository 和 `ingestEvent` service，最后用单元测试与集成测试验证最小闭环。整个过程遵循 TDD、最小实现、避免过早抽象。

**技术栈：** TypeScript、Node.js 或 Bun、SQLite、Drizzle 或 Kysely、Zod、Vitest

---

### 任务 1：建立工程基础类型与错误模型

**文件：**
- 创建：`src/shared/types.ts`
- 创建：`src/shared/result.ts`
- 创建：`src/shared/errors.ts`
- 测试：`tests/unit/shared/errors.test.ts`

**步骤 1：写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../src/shared/errors'

describe('ApiError', () => {
  it('should create structured error with code and message', () => {
    const error = new ApiError('INVALID_INPUT', 'bad input')

    expect(error.code).toBe('INVALID_INPUT')
    expect(error.message).toBe('bad input')
    expect(error.retryable).toBe(false)
  })
})
```

**步骤 2：运行测试验证它失败**

运行：`vitest run tests/unit/shared/errors.test.ts`
预期：FAIL，提示无法找到 `src/shared/errors.ts`

**步骤 3：写最少实现**

```ts
export type ApiErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNSUPPORTED_OPERATION'
  | 'STORAGE_ERROR'
  | 'RECALL_ERROR'
  | 'INTERNAL_ERROR'

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public details?: Record<string, unknown>,
    public retryable = false,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
```

并补齐：

```ts
// src/shared/types.ts
export type ID = string
export type ISODateTime = string
export type ProjectId = ID
export type UserId = ID
export type AgentId = ID
export type EventId = ID
```

```ts
// src/shared/result.ts
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
    retryable?: boolean
  }
}
```

**步骤 4：运行测试验证它通过**

运行：`vitest run tests/unit/shared/errors.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add src/shared/types.ts src/shared/result.ts src/shared/errors.ts tests/unit/shared/errors.test.ts
git commit -m "feat: add shared error and result types"
```

---

### 任务 2：建立基础配置加载

**文件：**
- 创建：`src/config/env.ts`
- 创建：`src/config/project-settings.ts`
- 测试：`tests/unit/config/project-settings.test.ts`

**步骤 1：写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { defaultProjectSettings } from '../../../src/config/project-settings'

describe('defaultProjectSettings', () => {
  it('should expose recall defaults', () => {
    expect(defaultProjectSettings.recall.defaultLimit).toBe(10)
    expect(defaultProjectSettings.recall.includeExplanationByDefault).toBe(true)
  })
})
```

**步骤 2：运行测试验证它失败**

运行：`vitest run tests/unit/config/project-settings.test.ts`
预期：FAIL，提示模块不存在

**步骤 3：写最少实现**

```ts
// src/config/project-settings.ts
export const defaultProjectSettings = {
  recall: {
    defaultLimit: 10,
    minScoreThreshold: 0.2,
    includeExplanationByDefault: true,
    includeEvidenceByDefault: false,
    includeDocumentsByDefault: true,
  },
}
```

```ts
// src/config/env.ts
export interface AppEnv {
  databasePath: string
}

export function readEnv(): AppEnv {
  return {
    databasePath: process.env.MEMORY_OS_DB_PATH ?? './data/memory-os.sqlite',
  }
}
```

**步骤 4：运行测试验证它通过**

运行：`vitest run tests/unit/config/project-settings.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add src/config/env.ts src/config/project-settings.ts tests/unit/config/project-settings.test.ts
git commit -m "feat: add base project settings"
```

---

### 任务 3：建立 SQLite 客户端骨架

**文件：**
- 创建：`src/db/client/sqlite.ts`
- 测试：`tests/unit/db/sqlite.test.ts`

**步骤 1：写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { createSqliteClient } from '../../../src/db/client/sqlite'

describe('createSqliteClient', () => {
  it('should return client metadata with configured path', () => {
    const client = createSqliteClient('/tmp/memory-os.sqlite')
    expect(client.path).toBe('/tmp/memory-os.sqlite')
  })
})
```

**步骤 2：运行测试验证它失败**

运行：`vitest run tests/unit/db/sqlite.test.ts`
预期：FAIL，提示模块不存在

**步骤 3：写最少实现**

```ts
export interface SqliteClient {
  path: string
}

export function createSqliteClient(path: string): SqliteClient {
  return { path }
}
```

注意：此任务不急于接入真实驱动，先固定调用边界。

**步骤 4：运行测试验证它通过**

运行：`vitest run tests/unit/db/sqlite.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add src/db/client/sqlite.ts tests/unit/db/sqlite.test.ts
git commit -m "feat: add sqlite client abstraction"
```

---

### 任务 4：建立 `projects` schema 定义

**文件：**
- 创建：`src/db/schema/projects.ts`
- 测试：`tests/unit/db/schema/projects.test.ts`
- 参考：`docs/schema.md`

**步骤 1：写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { projectsTable } from '../../../../src/db/schema/projects'

describe('projectsTable', () => {
  it('should define expected table name', () => {
    expect(projectsTable.name).toBe('projects')
  })
})
```

**步骤 2：运行测试验证它失败**

运行：`vitest run tests/unit/db/schema/projects.test.ts`
预期：FAIL，提示模块不存在

**步骤 3：写最少实现**

先用轻量结构固定 schema 元信息：

```ts
export const projectsTable = {
  name: 'projects',
  columns: {
    id: 'TEXT PRIMARY KEY',
    slug: 'TEXT NOT NULL UNIQUE',
    name: 'TEXT NOT NULL',
    description: 'TEXT',
    owner_user_id: 'TEXT NOT NULL',
    status: "TEXT NOT NULL DEFAULT 'active'",
    settings_json: 'TEXT',
    created_at: 'TEXT NOT NULL',
    updated_at: 'TEXT NOT NULL',
  },
} as const
```

不要在这个任务里引入完整 ORM DSL，只先把 schema 边界固定下来。

**步骤 4：运行测试验证它通过**

运行：`vitest run tests/unit/db/schema/projects.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add src/db/schema/projects.ts tests/unit/db/schema/projects.test.ts
git commit -m "feat: add projects schema definition"
```

---

### 任务 5：建立 `events` schema 定义

**文件：**
- 创建：`src/db/schema/events.ts`
- 测试：`tests/unit/db/schema/events.test.ts`
- 参考：`docs/schema.md`

**步骤 1：写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { eventsTable } from '../../../../src/db/schema/events'

describe('eventsTable', () => {
  it('should define expected table name and required columns', () => {
    expect(eventsTable.name).toBe('events')
    expect(eventsTable.columns.project_id).toBeDefined()
    expect(eventsTable.columns.event_type).toBeDefined()
  })
})
```

**步骤 2：运行测试验证它失败**

运行：`vitest run tests/unit/db/schema/events.test.ts`
预期：FAIL

**步骤 3：写最少实现**

```ts
export const eventsTable = {
  name: 'events',
  columns: {
    id: 'TEXT PRIMARY KEY',
    project_id: 'TEXT NOT NULL',
    user_id: 'TEXT NOT NULL',
    agent_id: 'TEXT',
    event_type: 'TEXT NOT NULL',
    source_type: 'TEXT NOT NULL',
    scope_type: 'TEXT NOT NULL',
    scope_key: 'TEXT',
    title: 'TEXT',
    summary: 'TEXT',
    content_text: 'TEXT',
    payload_json: 'TEXT',
    content_storage_mode: "TEXT NOT NULL DEFAULT 'full_text'",
    importance_score: 'REAL NOT NULL DEFAULT 0.5',
    happened_at: 'TEXT NOT NULL',
    created_at: 'TEXT NOT NULL',
  },
} as const
```

**步骤 4：运行测试验证它通过**

运行：`vitest run tests/unit/db/schema/events.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add src/db/schema/events.ts tests/unit/db/schema/events.test.ts
git commit -m "feat: add events schema definition"
```

---

### 任务 6：定义事件领域类型与输入契约

**文件：**
- 创建：`src/domain/event/types.ts`
- 创建：`src/domain/event/contracts.ts`
- 测试：`tests/unit/domain/event/contracts.test.ts`
- 参考：`docs/api.md`

**步骤 1：写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { isValidEventType } from '../../../../src/domain/event/contracts'

describe('event contracts', () => {
  it('should validate supported event type', () => {
    expect(isValidEventType('message')).toBe(true)
    expect(isValidEventType('unknown')).toBe(false)
  })
})
```

**步骤 2：运行测试验证它失败**

运行：`vitest run tests/unit/domain/event/contracts.test.ts`
预期：FAIL

**步骤 3：写最少实现**

```ts
// src/domain/event/types.ts
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
```

```ts
// src/domain/event/contracts.ts
import type { EventType } from './types'

const eventTypes: EventType[] = [
  'message',
  'tool_call',
  'tool_result',
  'decision',
  'error',
  'feedback',
  'system',
]

export function isValidEventType(value: string): value is EventType {
  return eventTypes.includes(value as EventType)
}
```

**步骤 4：运行测试验证它通过**

运行：`vitest run tests/unit/domain/event/contracts.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add src/domain/event/types.ts src/domain/event/contracts.ts tests/unit/domain/event/contracts.test.ts
git commit -m "feat: add event domain contracts"
```

---

### 任务 7：实现 `ingestEvent` 输入校验

**文件：**
- 创建：`src/services/validators/ingest-event-validator.ts`
- 测试：`tests/unit/services/validators/ingest-event-validator.test.ts`
- 参考：`docs/api.md`

**步骤 1：写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { validateIngestEventInput } from '../../../../../src/services/validators/ingest-event-validator'

describe('validateIngestEventInput', () => {
  it('should reject empty projectId', () => {
    expect(() =>
      validateIngestEventInput({
        projectId: '',
        userId: 'u1',
        event: {
          eventType: 'message',
          sourceType: 'claude',
          scope: { type: 'project' },
        },
      }),
    ).toThrow()
  })
})
```

**步骤 2：运行测试验证它失败**

运行：`vitest run tests/unit/services/validators/ingest-event-validator.test.ts`
预期：FAIL

**步骤 3：写最少实现**

使用 Zod 或最小手写校验实现：

```ts
import { ApiError } from '../../shared/errors'

export function validateIngestEventInput(input: {
  projectId: string
  userId: string
  event: {
    eventType: string
    sourceType: string
    scope: { type: string }
    importanceScore?: number
  }
}) {
  if (!input.projectId) {
    throw new ApiError('INVALID_INPUT', 'projectId is required')
  }

  if (!input.userId) {
    throw new ApiError('INVALID_INPUT', 'userId is required')
  }

  if (!input.event?.eventType) {
    throw new ApiError('INVALID_INPUT', 'event.eventType is required')
  }

  if (!input.event?.sourceType) {
    throw new ApiError('INVALID_INPUT', 'event.sourceType is required')
  }

  if (!input.event?.scope?.type) {
    throw new ApiError('INVALID_INPUT', 'event.scope.type is required')
  }

  if (
    input.event.importanceScore !== undefined &&
    (input.event.importanceScore < 0 || input.event.importanceScore > 1)
  ) {
    throw new ApiError('INVALID_INPUT', 'importanceScore must be between 0 and 1')
  }
}
```

**步骤 4：运行测试验证它通过**

运行：`vitest run tests/unit/services/validators/ingest-event-validator.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add src/services/validators/ingest-event-validator.ts tests/unit/services/validators/ingest-event-validator.test.ts
git commit -m "feat: add ingest event validator"
```

---

### 任务 8：建立 `project` 与 `event` repository 骨架

**文件：**
- 创建：`src/repositories/project-repository.ts`
- 创建：`src/repositories/event-repository.ts`
- 测试：`tests/unit/repositories/event-repository.test.ts`

**步骤 1：写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { InMemoryEventRepository } from '../../../src/repositories/event-repository'

describe('InMemoryEventRepository', () => {
  it('should store event records in memory', async () => {
    const repo = new InMemoryEventRepository()

    await repo.insert({ id: 'e1', projectId: 'p1', userId: 'u1', eventType: 'message' })

    const record = await repo.findById('e1')
    expect(record?.id).toBe('e1')
  })
})
```

**步骤 2：运行测试验证它失败**

运行：`vitest run tests/unit/repositories/event-repository.test.ts`
预期：FAIL

**步骤 3：写最少实现**

先实现内存版 repository，固定接口，再替换真实 SQLite：

```ts
export interface EventRecordLike {
  id: string
  projectId: string
  userId: string
  eventType: string
}

export class InMemoryEventRepository {
  private store = new Map<string, EventRecordLike>()

  async insert(record: EventRecordLike) {
    this.store.set(record.id, record)
  }

  async findById(id: string) {
    return this.store.get(id) ?? null
  }
}
```

`project-repository.ts` 也做同样的最小接口骨架。

**步骤 4：运行测试验证它通过**

运行：`vitest run tests/unit/repositories/event-repository.test.ts`
预期：PASS

**步骤 5：提交**

```bash
git add src/repositories/project-repository.ts src/repositories/event-repository.ts tests/unit/repositories/event-repository.test.ts
git commit -m "feat: add base repositories for projects and events"
```

---

### 任务 9：实现 `ingestEvent` service 最小闭环

**文件：**
- 创建：`src/services/ingest-event-service.ts`
- 测试：`tests/unit/services/ingest-event-service.test.ts`
- 依赖：`src/services/validators/ingest-event-validator.ts`
- 依赖：`src/repositories/event-repository.ts`
- 依赖：`src/shared/result.ts`

**步骤 1：写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { createIngestEventService } from '../../../src/services/ingest-event-service'
import { InMemoryEventRepository } from '../../../src/repositories/event-repository'

describe('createIngestEventService', () => {
  it('should persist event and return success response', async () => {
    const eventRepository = new InMemoryEventRepository()
    const service = createIngestEventService({ eventRepository })

    const result = await service({
      projectId: 'p1',
      userId: 'u1',
      event: {
        eventType: 'message',
        sourceType: 'claude',
        scope: { type: 'project' },
        contentText: 'hello',
      },
    })

    expect(result.success).toBe(true)
    expect(result.data?.accepted).toBe(true)
    expect(result.data?.eventId).toBeDefined()
  })
})
```

**步骤 2：运行测试验证它失败**

运行：`vitest run tests/unit/services/ingest-event-service.test.ts`
预期：FAIL

**步骤 3：写最少实现**

```ts
import { randomUUID } from 'node:crypto'
import { validateIngestEventInput } from './validators/ingest-event-validator'

export function createIngestEventService(deps: {
  eventRepository: {
    insert(record: {
      id: string
      projectId: string
      userId: string
      eventType: string
    }): Promise<void>
  }
}) {
  return async function ingestEvent(input: {
    projectId: string
    userId: string
    event: {
      eventType: string
      sourceType: string
      scope: { type: string }
      contentText?: string
      importanceScore?: number
    }
  }) {
    validateIngestEventInput(input)

    const eventId = randomUUID()

    await deps.eventRepository.insert({
      id: eventId,
      projectId: input.projectId,
      userId: input.userId,
      eventType: input.event.eventType,
    })

    return {
      success: true,
      data: {
        eventId,
        accepted: true,
        deduplicated: false,
        extractedMemoryIds: [],
        extractedEntityIds: [],
      },
    }
  }
}
```

**步骤 4：运行测试验证它通过**

运行：`vitest run tests/unit/services/ingest-event-service.test.ts`
预期：PASS

**步骤 5：运行相关测试集**

运行：`vitest run tests/unit/shared/errors.test.ts tests/unit/config/project-settings.test.ts tests/unit/db/sqlite.test.ts tests/unit/db/schema/projects.test.ts tests/unit/db/schema/events.test.ts tests/unit/domain/event/contracts.test.ts tests/unit/services/validators/ingest-event-validator.test.ts tests/unit/repositories/event-repository.test.ts tests/unit/services/ingest-event-service.test.ts`
预期：PASS

**步骤 6：提交**

```bash
git add src/services/ingest-event-service.ts tests/unit/services/ingest-event-service.test.ts
git commit -m "feat: add minimal ingest event service"
```

---

### 任务 10：增加最小集成测试，验证事件闭环

**文件：**
- 创建：`tests/integration/ingest-event.integration.test.ts`
- 参考：`src/services/ingest-event-service.ts`

**步骤 1：写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { createIngestEventService } from '../../src/services/ingest-event-service'
import { InMemoryEventRepository } from '../../src/repositories/event-repository'

describe('ingest event integration', () => {
  it('should validate then persist event', async () => {
    const eventRepository = new InMemoryEventRepository()
    const service = createIngestEventService({ eventRepository })

    const response = await service({
      projectId: 'p1',
      userId: 'u1',
      event: {
        eventType: 'message',
        sourceType: 'claude',
        scope: { type: 'project' },
        contentText: 'hello world',
      },
    })

    expect(response.success).toBe(true)
    expect(await eventRepository.findById(response.data!.eventId)).not.toBeNull()
  })
})
```

**步骤 2：运行测试验证它失败**

运行：`vitest run tests/integration/ingest-event.integration.test.ts`
预期：FAIL，若前置代码完整则应只在缺测试文件时失败

**步骤 3：补最少实现**

如果测试因 repository 或 service 接口不完整而失败，只做最小补全，不做额外抽象。

**步骤 4：运行测试验证它通过**

运行：`vitest run tests/integration/ingest-event.integration.test.ts`
预期：PASS

**步骤 5：运行最小全量测试**

运行：`vitest run`
预期：PASS

**步骤 6：提交**

```bash
git add tests/integration/ingest-event.integration.test.ts
git commit -m "test: add ingest event integration coverage"
```

---

## 交接说明

完成这份计划后，下一批任务应继续：

1. `memories` / `event_memory_links` schema
2. `extractMemories` service
3. 基础 recall pipeline

优先顺序应继续遵循：

```text
ingestEvent -> extractMemories -> recallMemories
```

在 `ingestEvent` 最小闭环完成前，不要提前做 feedback、document、adapter。
