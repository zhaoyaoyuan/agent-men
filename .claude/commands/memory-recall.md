---
name: memory-recall
description: 从 Memory OS 召回当前项目的相关记忆
parameters:
  - name: query
    description: 查询内容（你要做什么任务）
    required: true
---

# 🧠 Memory OS：召回相关记忆

## 自动查询当前项目记忆

```bash
#!/bin/bash
# 获取当前项目名称（git 根目录名称）
PROJECT=$(git rev-parse --show-toplevel 2>/dev/null | xargs basename)
if [ -z "$PROJECT" ]; then
  PROJECT=$(basename "$(pwd)")
fi

echo "Project: $PROJECT"
echo "Query: $query"
echo

# 调用 Memory OS API
curl -s -X POST http://localhost:3000/api/recall \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT\",
    \"userId\": \"me\",
    \"query\": \"$query\",
    \"options\": { \"limit\": 6 }
  }" | python3 -m json.tool 2>/dev/null || echo "{}"
```

---

## 👆 上面是召回结果

请根据召回的记忆来协助我完成任务：**$query**

- 严格遵守记忆中记录的技术决策、架构选择、编码风格
- 尊重记忆中的用户偏好和约束条件
- 参考记忆中的经验教训避免重复踩坑
- 如果记忆中有已完成的工作，不要重复发明轮子
