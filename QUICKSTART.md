# 快速开始

## 5 分钟启动

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入你的 Anthropic API 密钥：

```env
ANTHROPIC_API_KEY=sk-你的密钥在这里
```

### 3. 启动服务

```bash
npm run dev
```

服务器启动在 `http://localhost:3000`

## 第一次使用

### 摄入一个事件

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "my-first-project",
    "userId": "me",
    "event": {
      "eventType": "conversation",
      "sourceType": "chat",
      "scopeType": "project",
      "contentText": "我在开发一个 AI 记忆系统，用户偏好深色模式界面，工作时间是北京时区 9点 到 17点"
    }
  }'
```

你会得到一个响应，其中包含 `eventId`：

```json
{
  "success": true,
  "data": {
    "eventId": "a1b2c3...",
    "accepted": true
  }
}
```

### 提取记忆

用上面得到的 `eventId` 替换 `<event-id>`：

```bash
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "my-first-project",
    "userId": "me",
    "eventIds": ["<event-id>"]
  }'
```

响应会告诉你提取出了几个记忆：

```json
{
  "success": true,
  "data": {
    "created": ["mem-1...", "mem-2..."],
    "updated": [],
    "skipped": []
  }
}
```

### 召回记忆

```bash
curl -X POST http://localhost:3000/api/recall \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "my-first-project",
    "userId": "me",
    "query": "用户工作时间",
    "options": {
      "limit": 5
    }
  }'
```

你会得到按相似度排序的记忆列表：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "memoryId": "...",
        "memoryType": "preference",
        "title": "用户工作时间",
        "content": "用户工作时间是北京时区 9点 到 17点",
        "similarity": 0.75,
        "eventIds": ["a1b2c3..."]
      }
    ],
    "packet": {
      "preferences": [...]
    }
  }
}
```

## 下一步

- 阅读 [README.md](./README.md) 了解完整功能
- 阅读 [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) 了解开发细节
- 阅读 [docs/architecture.md](./docs/architecture.md) 了解完整架构设计

## 常见问题

**Q: 需要什么 Node.js 版本？**
A: Node.js 18+ 推荐，16+ 也可以运行。

**Q: 数据存在哪里？**
A: 默认在 `./data/memory-os.sqlite` SQLite 数据库文件。

**Q: 支持其他 LLM 吗？**
A: 当前只支持 Anthropic Claude。可以很容易添加 OpenAI 支持，看 [src/clients/](./src/clients/)。

**Q: 如何重置数据库？**
A: 删除 `./data/memory-os.sqlite` 文件，下次启动会自动重建。
