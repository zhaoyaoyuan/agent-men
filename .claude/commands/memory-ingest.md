---
name: memory-ingest
description: 把当前任务的重要决策和结果摄入到 Memory OS
parameters:
  - name: content
    description: 要记忆的内容（决策、结论、偏好、教训等）
    required: true
---

# 🧠 Memory OS：摄入新记忆

## 摄入内容到当前项目

```bash
#!/bin/bash
# 获取当前项目名称（git 根目录名称）
PROJECT=$(git rev-parse --show-toplevel 2>/dev/null | xargs basename)
if [ -z "$PROJECT" ]; then
  PROJECT=$(basename "$(pwd)")
fi

# 转义 content 中的引号
CONTENT=$(cat <<'EOF'
$content
EOF
)

echo "Project: $PROJECT"
echo "Ingesting: $CONTENT"
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
      \"contentText\": $(printf '%s' "$CONTENT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
    }
  }")

echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
```

---

## 提取记忆

从上一步摄入的事件中提取结构化记忆：

```bash
#!/bin/bash
PROJECT=$(git rev-parse --show-toplevel 2>/dev/null | xargs basename)
if [ -z "$PROJECT" ]; then
  PROJECT=$(basename "$(pwd)")
fi

# 从上次响应获取 eventId（需要用户替换，但通常用户可以从上面复制）
echo "请从上文的响应中复制 eventId 并运行："
echo ''
echo 'curl -s -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"'$PROJECT'\",
    \"userId\": \"me\",
    \"eventIds\": [\"<event-id>\"]
  }" | python3 -m json.tool
```

---

## 完成

内容已摄入，提取完成后记忆就会被永久保存，未来召回可以参考这次的决策。
