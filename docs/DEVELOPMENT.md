# 开发指南

## 项目结构

```
agent-mem/
├── src/
│   ├── config/          # 配置加载
│   ├── api/            # HTTP API 层
│   ├── services/       # 业务逻辑服务
│   ├── repositories/  # 数据访问层
│   ├── db/            # 数据库 schema 和客户端
│   ├── clients/       # 外部客户端（LLM 等）
│   └── index.ts       # 应用入口
├── tests/
│   ├── unit/          # 单元测试
│   └── integration/   # 集成测试
├── data/              # SQLite 数据库文件（git 忽略）
├── docs/              # 文档
└── package.json
```

## 技术栈

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.x
- **HTTP Framework**: [Hono](https://hono.dev/)
- **Database**: [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- **LLM Client**: [@anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk)
- **Testing**: [Vitest](https://vitest.dev/)
- **Code Format**: Prettier
- **Type Checking**: TypeScript

## 开发环境设置

```bash
# 安装依赖
npm install

# 复制环境变量示例
cp .env.example .env

# 编辑 .env 添加你的 Anthropic API 密钥
```

## 开发命令

```bash
# 开发模式（热重载）
npm run dev

# 运行所有测试
npm test

# 运行单个测试文件
npm test tests/unit/config/env.test.ts

# 覆盖率报告
npm run test:coverage

# 类型检查
npm run typecheck

# lint 检查
npm run lint

# 格式化代码
npm run format

# 生产构建
npm run build

# 生产运行
npm start
```

## 架构设计

### 分层架构

项目遵循清晰的分层原则：

1. **API 层** (`src/api/`) - HTTP 路由、输入验证、错误处理
2. **服务层** (`src/services/`) - 业务逻辑、用例编排
3. **仓储层** (`src/repositories/`) - 数据访问抽象、CRUD 操作
4. **客户端层** (`src/clients/`) - 外部服务集成（LLM 等）

### 依赖注入

所有组件依赖接口而非具体实现：

```typescript
// 接口定义
export interface LLMClient {
  extractMemoriesFromEvent(eventContent: string): Promise<ExtractedMemory[]>
}

// 具体实现
export class AnthropicLLMClient implements LLMClient { ... }

// 服务依赖注入
export function createExtractMemoriesService(deps: {
  projectRepository: ProjectRepository
  eventRepository: EventRepository
  memoryRepository: MemoryRepository
  eventMemoryLinkRepository: EventMemoryLinkRepository
  llmClient: LLMClient
}) {
  // ... 使用依赖，不关心具体实现
}
```

这种设计的好处：
- 易于测试（可以轻松 mock 依赖）
- 易于替换实现（比如切换到 OpenAI）
- 遵循依赖倒置原则

### 命名约定：双格式兼容

数据库使用 `snake_case`，服务层使用 `camelCase`。所有记录同时包含两种格式：

```typescript
// 数据库存储层（snake_case）
project_id: string
user_id: string

// 服务层别名（camelCase）
projectId: string
userId: string

// 两者同时存在，消费方自由使用
```

输入同时支持两种格式，通过 `normalize*` 函数统一转换。

## 测试策略

遵循 **TDD（测试驱动开发）**：

1. 写失败测试（红）
2. 写最少代码让它通过（绿）
3. 重构（保持绿色）

### 测试分类

| 类型 | 位置 | 说明 |
|------|------|------|
| 单元测试 | `tests/unit/` | 单独测试函数/类 |
| 集成测试 | `tests/integration/` | 测试多个组件协作 |
| E2E 测试 | `tests/e2e/` | 测试完整 API 流程 |

### 覆盖率要求

最低覆盖率要求：**80%+**

运行 `npm run test:coverage` 查看报告。

### 编写测试示例

```typescript
import { describe, expect, it } from 'vitest'
import { yourFunction } from './your-file'

describe('yourFunction', () => {
  it('should do what you expect', () => {
    const result = yourFunction()
    expect(result).toBe(true)
  })
})
```

## 添加新功能

1. **写测试** - 在 `tests/` 写失败测试
2. **运行测试** - 确认它因正确原因失败
3. **实现功能** - 写最少代码让测试通过
4. **运行测试** - 确认测试通过
5. **重构** - 清理代码，保持测试通过
6. **验证覆盖率** - 确保新增代码覆盖到位

## 数据库迁移

SQLite 数据库 schema 初始化逻辑在 `src/db/client/sqlite.ts`。首次启动时会自动创建表。

添加新表：
1. 创建 `src/db/schema/<table-name>.ts` - 写 `CREATE TABLE` DDL
2. 在 `createTablesIfNotExists` 函数中执行 DDL
3. 创建对应的接口和仓储实现

## 代码风格

请遵循 `.prettierrc` 格式化，以及：

- 文件保持短小（200-400 行最佳，最大 800 行）
- 函数保持短小（< 50 行）
- 使用不可变更新（不修改输入对象）
- 所有错误必须处理
- 避免深层嵌套（< 4 层）

## 向项目贡献

1. Fork 仓库
2. 创建特性分支 (`git checkout -b feature/my-feature`)
3. 遵循 TDD 实现，确保所有测试通过
4. 提交符合约定的 commit (`feat: add my feature`)
5. 创建 Pull Request

## 故障排除

### 常见问题

**Q: `better-sqlite3` 安装失败**
A: 需要 Node.js 原生编译工具，运行：`npm install --build-from-source better-sqlite3`

**Q: Anthropic API 调用失败**
A: 检查 `ANTHROPIC_API_KEY` 是否正确，以及账户额度是否充足

**Q: 测试失败，但我没改相关代码**
A: 检查测试隔离性，某些测试可能修改了共享状态

### 获取帮助

如果遇到问题，请创建 Issue 并包含：
- Node.js 版本
- 操作系统
- 完整错误日志
- 复现步骤
