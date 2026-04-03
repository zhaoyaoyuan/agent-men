---
name: memory-os-recall
description: 从 Memory OS 召回当前项目的相关记忆。在 Claude Code 中开始任何新任务之前，如果项目有 Memory OS 记忆系统，都应该使用这个 skill 召回相关记忆、技术决策、用户偏好和经验教训。当用户说"开始任务"、"继续开发"、"修复bug"、"实现功能"时，都应该触发这个 skill。
---

# Memory OS 召回 Skill

在 Claude Code 中开始任何新任务之前，使用这个 skill 从 Memory OS 召回当前项目的相关记忆。

## 工作流程

1. **自动检测项目**：使用 git 根目录名称作为 projectId，自动隔离不同项目的记忆
2. **调用 Memory OS API**：向本地运行的 Memory OS 服务发起召回请求
3. **展示召回结果**：把召回的记忆展示给你（Claude）
4. **指导行为**：指导你如何根据召回的记忆来协助用户

## 前置条件

- Memory OS 服务必须已经在本地运行 (`http://localhost:3000`)
- 你（Claude Code）需要能够执行 `curl` 命令调用 API
- 用户已经将重要决策和历史记忆摄入到 Memory OS 中

## 使用步骤

### 1. 检测当前项目

```bash
# 获取当前项目名称（git 根目录名称）
PROJECT=$(git rev-parse --show-toplevel 2>/dev/null | xargs basename)
if [ -z "$PROJECT" ]; then
  PROJECT=$(basename "$(pwd)")
fi
echo "当前项目: $PROJECT"
```

### 2. 调用召回 API

用户会提供查询内容（他们要做什么任务），使用这个内容调用 API：

```bash
curl -s -X POST http://localhost:3000/api/recall \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT\",
    \"userId\": \"me\",
    \"query\": \"$QUERY\",
    \"options\": { \"limit\": 6 }
  }" | python3 -m json.tool 2>/dev/null || echo "{}"
```

### 3. 处理响应

API 返回格式：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "memoryId": "...",
        "memoryType": "preference|fact|constraint|task_state|experience",
        "title": "记忆标题",
        "content": "记忆内容",
        "similarity": 0.75,
        "confidence": 0.9,
        "eventIds": ["..."]
      }
    ],
    "packet": {
      "facts": [...],
      "constraints": [...],
      "preferences": [...],
      "taskStates": [...],
      "experiences": [...]
    },
    "meta": {
      "totalFound": 2,
      "returned": 1
    }
  }
}
```

### 4. 指导你如何行动

拿到召回结果后，你（Claude）必须：

---

## 🧠 召回结果使用规则

**严格遵守**以下规则：

1. **尊重已有决策**：如果召回结果中有明确的技术决策、架构选择、编码风格，必须严格遵守，不能提出相反的方案
2. **尊重用户偏好**：任何 `preference` 类型的记忆都是用户明确表达的偏好，必须遵从
3. **避免重复踩坑**：`experience` 类型的记忆通常是之前踩过的坑，要避免重复犯错
4. **复用已有知识**：如果召回结果中有已经实现的功能、代码结构、设计思路，尽量复用，不要重新发明轮子
5. **保持一致性**：项目已有的架构和编码风格要保持一致

---

## 参数说明

这个 skill 需要一个参数：

- **`query`**：**必填** - 用户要做什么任务，用这个作为关键词召回相关记忆

## 示例

用户输入：
```
/memory-os-recall query=实现用户登录功能
```

输出：
- 打印当前项目名称
- 调用 API 显示召回的记忆列表
- 然后提示你根据召回结果开始工作

## 故障排除

| 问题 | 解决方法 |
|------|---------|
| `curl` 连接失败 | 确认 Memory OS 服务已启动：`cd /path/to/agent-mem && npm start` |
| 返回空结果 | 这正常，说明还没有相关记忆，继续工作完成后记得用 `memory-os-ingest` 摄入 |
| Python json 格式化失败 | 不影响，返回的原始 JSON 仍然可读 |
