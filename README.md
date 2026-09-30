# 任务奖励中心（Task Reward Center）

简化版任务奖励系统：用户浏览并完成任务、领取积分奖励；运营人员创建/管理任务并查看完成与领取记录。

## 技术栈

- 后端：Node.js + Express + better-sqlite3（WAL 模式，零配置本地数据库）
- 前端：React 18 + Vite（开发时代理 `/api` 到后端）
- 身份：页面右上角下拉框切换身份（演示用，无真实鉴权；后端按 `x-user-id` 请求头识别身份并做角色校验）

## 快速开始

```bash
npm run setup     # 安装 server 与 web 依赖
npm run dev       # 同时启动后端（:3001）与前端（:5173）
```

打开 http://localhost:5173 即可使用。首次启动自动建表并写入种子数据。

种子身份：`alice` / `bob`（普通用户）、`ops_admin`（运营）。

## 功能

普通用户：

- 任务大厅：查看任务、奖励、名额与我的状态（可参与 / 已完成待领取 / 已领取）
- 完成任务 → 领取奖励（重复完成/领取幂等，不会重复发奖）
- 积分汇总与领取记录

运营人员：

- 新建 / 编辑任务（标题、说明、奖励积分、名额限制）
- 任务上架 / 下架
- 按任务查看完成与领取明细、全局流水看板

## 数据模型

- `users`：用户与角色（user / ops）
- `tasks`：任务（奖励积分、上下架状态、名额上限）
- `completions`：任务完成记录（`UNIQUE(user_id, task_id)` 天然幂等）
- `claims`：奖励领取记录（积分快照，`UNIQUE(user_id, task_id)` 防重复发放）

领取接口在单个事务中完成「校验已完成 → 防重 → 写入领取记录」，并发/重试下不会重复发奖。

## API 概览

| 方法 | 路径 | 说明 | 角色 |
| --- | --- | --- | --- |
| GET | `/api/users` | 可切换身份列表 | 任意 |
| GET | `/api/me/summary` | 我的积分/完成/领取汇总 | 登录 |
| GET | `/api/me/claims` | 我的领取记录 | 登录 |
| GET | `/api/tasks` | 任务大厅（含我的状态） | 登录 |
| POST | `/api/tasks/:id/complete` | 完成任务（幂等） | 登录 |
| POST | `/api/tasks/:id/claim` | 领取奖励（事务+幂等） | 登录 |
| GET | `/api/ops/tasks` | 任务列表（含统计） | 运营 |
| POST | `/api/ops/tasks` | 创建任务 | 运营 |
| PUT | `/api/ops/tasks/:id` | 更新任务 | 运营 |
| POST | `/api/ops/tasks/:id/status` | 上/下架 | 运营 |
| GET | `/api/ops/tasks/:id/records` | 任务完成/领取明细 | 运营 |
| GET | `/api/ops/records` | 全局流水 | 运营 |

## 目录结构

```
server/    Express API + SQLite（db.js 建表、seed.js 种子、index.js 路由）
web/       React + Vite 前端（src/components 下用户/运营两个视图）
```
