# 启动任务：补全项目开发规范

**你（AI）正在执行这个任务，开发者不会直接阅读这个文件。**

开发者刚刚第一次在这个项目里运行了 `trellis init`。
现在 `.trellis/` 已创建，里面包含待补全的 spec 脚手架，这个启动任务也已经
出现在 `.trellis/tasks/` 下。当他们准备处理它时，应当在提供 Trellis 会话身份
的会话里启动这个任务。

**你的目标**：帮助他们把团队真实的编码规范补充进 `.trellis/spec/`。
未来这个项目里的每次 AI 会话——包括 `trellis-implement` 和 `trellis-check`
子代理——都会自动加载每个任务 jsonl 清单里列出的 spec 文件。spec 为空，
子代理就会写出泛化代码；spec 真实完整，子代理才会贴近团队现有风格。

不要一上来倾倒说明。先用一句简短欢迎语开场，确认仓库里是否已有约定文档
（如 CLAUDE.md、.cursorrules 等），再以对话方式推进。

---

## 当前状态（完成后更新下面复选框）

- [ ] 补充后端开发规范
- [ ] 补充前端开发规范
- [ ] 补充代码示例

---

## 需要补充的 Spec 文件


### 后端规范

| 文件 | 需要记录的内容 |
|------|----------------|
| `.trellis/spec/backend/directory-structure.md` | 各类文件的放置位置（routes、services、utils 等） |
| `.trellis/spec/backend/database-guidelines.md` | ORM、迁移、查询模式、命名约定 |
| `.trellis/spec/backend/error-handling.md` | 错误如何捕获、记录和返回 |
| `.trellis/spec/backend/logging-guidelines.md` | 日志级别、格式、记录范围 |
| `.trellis/spec/backend/quality-guidelines.md` | 代码评审标准、测试要求 |


### 前端规范

| 文件 | 需要记录的内容 |
|------|----------------|
| `.trellis/spec/frontend/directory-structure.md` | 组件、页面、hook 的组织方式 |
| `.trellis/spec/frontend/component-guidelines.md` | 组件模式、props 约定 |
| `.trellis/spec/frontend/hook-guidelines.md` | 自定义 hook 命名与模式 |
| `.trellis/spec/frontend/state-management.md` | 本地状态、全局状态、服务端状态的使用方式 |
| `.trellis/spec/frontend/type-safety.md` | TypeScript 约定、类型组织方式 |
| `.trellis/spec/frontend/quality-guidelines.md` | 代码规范、禁用模式 |


### 思考指南（已预填）

`.trellis/spec/guides/` 中已预置通用思考指南。
只有当其中内容明显不适合当前项目时，才需要调整。

---

## 如何补充 Spec

### 第一步：优先导入已有约定文档（推荐）

先在仓库中搜索已有的约定文档。如果存在，先读这些文件，再把相关规则整理到对应
的 `.trellis/spec/` 文件里——这通常比从零开始快得多。

| 文件 / 目录 | 工具 |
|------|------|
| `CLAUDE.md` / `CLAUDE.local.md` | Claude Code |
| `AGENTS.md` | Codex / Claude Code / 兼容 agent 的工具 |
| `.cursorrules` | Cursor |
| `.cursor/rules/*.mdc` | Cursor（规则目录） |
| `.windsurfrules` | Windsurf |
| `.clinerules` | Cline |
| `.roomodes` | Roo Code |
| `.github/copilot-instructions.md` | GitHub Copilot |
| `.vscode/settings.json` → `github.copilot.chat.codeGeneration.instructions` | VS Code Copilot |
| `CONVENTIONS.md` / `.aider.conf.yml` | aider |
| `CONTRIBUTING.md` | 通用项目约定 |
| `.editorconfig` | 编辑器格式规则 |

### 第二步：分析代码库中未被文档覆盖的部分

从真实代码里归纳模式。写每个 spec 文件前：
- 先找到 2-3 个真实示例。
- 记录真实文件路径，不要写假想路径。
- 记下团队明确避免的反模式。

### 第三步：记录现实，而不是理想状态

**关键**：写代码库现在**实际上怎样做**，而不是“应该怎样做”。
子代理会按 spec 来实现；如果 spec 写的是不存在的理想模式，后续生成的代码就会和
仓库现状脱节。

如果团队存在已知技术债，请记录当前现状——如何改进是后续话题，不属于这次启动任务。

---

## 运行时机制速览（当开发者问“为什么需要 spec”时再解释）

- 每个 AI 编码任务都会派生两个子代理：`trellis-implement`（负责写代码）和
  `trellis-check`（负责验证质量）。
- 每个任务都有 `implement.jsonl` / `check.jsonl` 清单，用于列出需要加载的 spec 文件。
- 平台 hook 会自动把这些 spec 文件以及任务的 `prd.md` 注入到每个子代理的 prompt 中，
  这样它们能按团队约定编码或评审，而不需要人工反复粘贴。
- 唯一事实来源是 `.trellis/spec/`。这也是为什么现在把它补好，会长期持续收益。

---

## 完成方式

当开发者确认上面的清单都已结合真实示例补完后，引导他们执行：

```bash
python ./.trellis/scripts/task.py finish
python ./.trellis/scripts/task.py archive 00-bootstrap-guidelines
```

归档后，后续每位新加入这个项目的开发者拿到的将不再是这个启动任务，而是
`00-join-<slug>` 入项引导任务。

---

## 建议开场白

“欢迎使用 Trellis！刚才的初始化已经让我可以帮助你补齐项目 spec。这是一次性设置，
做好之后，后续每次 AI 会话都会按团队规范工作，而不是产出泛化代码。开始前你手头有
现成的约定文档（如 CLAUDE.md、.cursorrules、CONTRIBUTING.md）可以先让我读取吗？
如果没有，我就从代码库里开始归纳。”
