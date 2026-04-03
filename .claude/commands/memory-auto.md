---
name: memory-auto
description: 自动工作流 - 开始任务前召回，任务完成后摄入结论
parameters:
  - name: task
    description: 你要做什么任务
    required: true
---

# 🧠 Memory OS：自动工作流

## 第一步：召回相关记忆

```bash
#!/bin/bash
PROJECT=$(git rev-parse --show-toplevel 2>/dev/null | xargs basename)
if [ -z "$PROJECT" ]; then
  PROJECT=$(basename "$(pwd)")
fi

echo "Project: $PROJECT"
echo "Task: $task"
echo

curl -s -X POST http://localhost:3000/api/recall \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT\",
    \"userId\": \"me\",
    \"query\": \"$task\",
    \"options\": { \"limit\": 6 }
  }" | python3 -m json.tool 2>/dev/null || echo "{}"
```

---

## 📋 工作流程

1.  **你**：阅读上面召回的记忆，然后开始完成任务 **$task**
2.  **完成后**：运行 `/memory-ingest 在这里粘贴总结你的决策、结论和结果`
3.  **Memory OS**：自动保存记忆，供未来任务召回使用

---

## 为什么这样设计

- 开始任务前召回 → 避免重复踩坑，尊重已有决策
- 完成任务后记错 → 持续积累项目知识
- 项目自动隔离 → 不同项目记忆互不干扰
- 永久保存 → 即使 Claude Code 重启，记忆仍然存在

开始任务吧！
