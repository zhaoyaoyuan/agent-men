---
name: memory-os-auto
description: Memory OS 全自动工作流 - 开始任务前自动召回相关记忆，任务完成后自动摄入结论。在 Claude Code 中开始任何新任务时都应该使用这个 skill，它会先从 Memory OS 获取历史记忆帮助你做出更明智的决策。当用户说"开始任务"、"来做这个功能"时，应该触发这个 skill。
---

# Memory OS 全自动工作流

全自动工作流：**开始任务前召回记忆 → 你完成任务 → 任务完成后摄入结论**

## 工作流程

1. **第一步：自动召回** - 检测当前项目，根据任务描述召回相关记忆
2. **阅读并遵守** - 你阅读召回的记忆，严格遵守已有决策、偏好和经验教训
3. **完成任务** - 你协助用户完成任务
4. **第二步：自动摄入** - 任务完成后，将结论摄入到 Memory OS 供未来使用

## 参数

这个 skill 需要一个参数：

- **`task`**：**必填** - 你要做什么任务

## 第一步：执行召回

```bash
#!/bin/bash
PROJECT=$(git rev-parse --show-toplevel 2>/dev/null | xargs basename)
if [ -z "$PROJECT" ]; then
  PROJECT=$(basename "$(pwd)")
fi

echo "项目: $PROJECT"
echo "任务: $task"
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

## 🧠 你（Claude）必须遵守的规则

阅读完上面的召回结果后，必须：

1. **严格遵守已有决策** - 如果召回结果中有明确的技术选择、架构设计、编码风格，必须遵从，不能提出相反方案
2. **尊重用户偏好** - 任何 `preference` 类型记忆都是用户明确偏好，必须满足
3. **避免重复踩坑** - `experience` 类型记忆记录了之前踩过的坑，不要重复犯错
4. **复用已有知识** - 如果已有实现，尽量复用，不要重复发明
5. **保持一致性** - 和项目已有的编码风格、架构设计保持一致

---

完成任务后，请用户运行：

```
/memory-os-ingest content=在这里总结这次任务的重要决策、结论和结果
```

这样结论就会被保存到 Memory OS，未来任务可以召回使用。

## 开始

现在根据召回的记忆，开始完成任务：**$task**
