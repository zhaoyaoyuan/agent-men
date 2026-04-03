---
name: memory-os-ingest
description: 将当前任务的重要决策、结论、结果摄入到 Memory OS，供未来任务召回使用。当任务完成后，应该使用这个 skill 将重要结论保存到记忆中。当用户说"完成了"、"保存记忆"、"总结一下"时，应该触发这个 skill。
---

# Memory OS 摄入 Skill

将当前任务完成后的重要决策、结论、结果摄入到 Memory OS，供未来任务召回使用。

## 工作流程

1. **自动检测项目**：使用 git 根目录名称作为 projectId
2. **摄入事件**：将用户提供的内容作为事件摄入到 Memory OS
3. **提取记忆**：提示用户复制 `eventId` 进行提取，将内容转为结构化记忆

## 前置条件

- Memory OS 服务必须已经在本地运行 (`http://localhost:3000`)
- 当前任务已完成，有需要保存的结论

## 使用

这个 skill 需要一个参数：

- **`content`**：**必填** - 要记忆的内容（决策、结论、偏好、教训、结果等）

## 使用步骤

```bash
#!/bin/bash
# 获取当前项目名称（git 根目录名称）
PROJECT=$(git rev-parse --show-toplevel 2>/dev/null | xargs basename)
if [ -z "$PROJECT" ]; then
  PROJECT=$(basename "$(pwd)")
fi

echo "项目: $PROJECT"
echo "内容: $content"
echo

# 调用 ingest API
RESPONSE=$(curl -s -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT\",
    \"userId\": \"me\",
    \"event\": {
      \"eventType\": \"decision\",
      \"sourceType\": \"claude-code\",
      \"scopeType\": \"project\",
      \"contentText\": $(printf '%s' "$content" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
    }
  }")

echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
```

获取响应后，复制 `eventId` 然后运行提取：

```bash
# 提取记忆（替换 EVENT_ID 为上面得到的 eventId）
curl -s -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT\",
    \"userId\": \"me\",
    \"eventIds\": [\"EVENT_ID\"]
  }" | python3 -m jsontool
```

## 完成后

内容已摄入并提取，记忆会被永久保存到 SQLite 数据库，未来任何任务都可以通过 `/memory-os-recall` 召回。

## 故障排除

| 问题 | 解决方法 |
|------|---------|
| 连接 refused | 确认 Memory OS 服务已启动：`cd /path/to/agent-mem && npm start` |
| 服务未启动 | 需要先启动服务才能使用，服务默认端口 3000 |
