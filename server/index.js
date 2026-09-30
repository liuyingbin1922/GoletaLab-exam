require('./seed');

const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ---------- helpers ----------

function getUser(req) {
  const id = Number(req.header('x-user-id'));
  if (!id) return null;
  return db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(id) || null;
}

function requireUser(req, res) {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: '未登录或用户不存在，请先切换身份' });
    return null;
  }
  return user;
}

function requireOps(req, res) {
  const user = requireUser(req, res);
  if (!user) return null;
  if (user.role !== 'ops') {
    res.status(403).json({ error: '仅运营人员可执行此操作' });
    return null;
  }
  return user;
}

function getTaskOr404(req, res) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(req.params.id));
  if (!task) {
    res.status(404).json({ error: '任务不存在' });
    return null;
  }
  return task;
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// 当前用户对某任务的状态：available / completed（已完成未领取）/ claimed（已领取）
const USER_TASK_STATUS = `
  CASE
    WHEN c.id IS NOT NULL THEN 'claimed'
    WHEN p.id IS NOT NULL THEN 'completed'
    ELSE 'available'
  END
`;

// ---------- routes ----------

// 可切换身份的用户列表
app.get('/api/users', (req, res) => {
  res.json(db.prepare('SELECT id, username, role FROM users ORDER BY id').all());
});

// 当前用户的汇总：积分（已领取之和）、完成数、领取数
app.get('/api/me/summary', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const row = db.prepare(`
    SELECT
      COALESCE((SELECT SUM(points) FROM claims WHERE user_id = @uid), 0) AS points,
      (SELECT COUNT(*) FROM completions WHERE user_id = @uid) AS completed_count,
      (SELECT COUNT(*) FROM claims WHERE user_id = @uid) AS claimed_count
  `).get({ uid: user.id });
  res.json({ user, ...row });
});

// 任务大厅：所有任务 + 我的状态 + 已参与人数
app.get('/api/tasks', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const tasks = db.prepare(`
    SELECT
      t.*,
      ${USER_TASK_STATUS} AS my_status,
      (SELECT COUNT(*) FROM completions c2 WHERE c2.task_id = t.id) AS participant_count
    FROM tasks t
    LEFT JOIN completions p ON p.task_id = t.id AND p.user_id = @uid
    LEFT JOIN claims c ON c.task_id = t.id AND c.user_id = @uid
    ORDER BY t.status = 'active' DESC, t.id DESC
  `).all({ uid: user.id });
  res.json(tasks);
});

// 完成任务（幂等：重复调用返回同一结果）
app.post('/api/tasks/:id/complete', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const task = getTaskOr404(req, res);
  if (!task) return;

  try {
    const result = db.transaction(() => {
      if (task.status !== 'active') throw new HttpError(400, '任务已下线，无法完成');
      const claimed = db.prepare('SELECT id FROM claims WHERE user_id = ? AND task_id = ?').get(user.id, task.id);
      if (claimed) throw new HttpError(400, '奖励已领取，无需重复完成');

      const existing = db.prepare('SELECT id FROM completions WHERE user_id = ? AND task_id = ?').get(user.id, task.id);
      if (existing) return { duplicated: true };

      if (task.max_completions != null) {
        const cnt = db.prepare('SELECT COUNT(*) AS c FROM completions WHERE task_id = ?').get(task.id).c;
        if (cnt >= task.max_completions) throw new HttpError(400, '该任务参与名额已满');
      }
      db.prepare('INSERT INTO completions (user_id, task_id) VALUES (?, ?)').run(user.id, task.id);
      return { duplicated: false };
    })();

    res.status(result.duplicated ? 200 : 201).json({
      message: result.duplicated ? '任务此前已完成' : '任务完成，可领取奖励',
    });
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

// 领取奖励（幂等且事务化：完成校验 + 防重 + 写领取记录一步完成）
app.post('/api/tasks/:id/claim', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const task = getTaskOr404(req, res);
  if (!task) return;

  try {
    const result = db.transaction(() => {
      const existing = db.prepare('SELECT id, points FROM claims WHERE user_id = ? AND task_id = ?').get(user.id, task.id);
      if (existing) return { duplicated: true, points: existing.points };

      const completion = db.prepare('SELECT id FROM completions WHERE user_id = ? AND task_id = ?').get(user.id, task.id);
      if (!completion) throw new HttpError(400, '请先完成任务再领取奖励');

      db.prepare('INSERT INTO claims (user_id, task_id, points) VALUES (?, ?, ?)').run(user.id, task.id, task.reward_points);
      return { duplicated: false, points: task.reward_points };
    })();

    res.status(result.duplicated ? 200 : 201).json({
      message: result.duplicated ? '奖励已领取过，未重复发放' : `领取成功，获得 ${result.points} 积分`,
      points: result.points,
    });
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

// 我的领取记录
app.get('/api/me/claims', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  res.json(db.prepare(`
    SELECT c.id, c.points, c.claimed_at, t.title, t.id AS task_id
    FROM claims c JOIN tasks t ON t.id = c.task_id
    WHERE c.user_id = ? ORDER BY c.id DESC
  `).all(user.id));
});

// ---------- ops 运营接口 ----------

// 任务列表（运营视角，含完成/领取统计）
app.get('/api/ops/tasks', (req, res) => {
  if (!requireOps(req, res)) return;
  res.json(db.prepare(`
    SELECT
      t.*,
      (SELECT COUNT(*) FROM completions c WHERE c.task_id = t.id) AS completion_count,
      (SELECT COUNT(*) FROM claims cl WHERE cl.task_id = t.id) AS claim_count,
      (SELECT COALESCE(SUM(cl2.points), 0) FROM claims cl2 WHERE cl2.task_id = t.id) AS claimed_points
    FROM tasks t ORDER BY t.id DESC
  `).all());
});

// 创建任务
app.post('/api/ops/tasks', (req, res) => {
  if (!requireOps(req, res)) return;
  const { title, description = '', reward_points, max_completions = null } = req.body || {};
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: '任务标题不能为空' });
  }
  const points = Number(reward_points);
  if (!Number.isInteger(points) || points <= 0) {
    return res.status(400).json({ error: '奖励积分必须为正整数' });
  }
  const max = max_completions == null || max_completions === '' ? null : Number(max_completions);
  if (max != null && (!Number.isInteger(max) || max <= 0)) {
    return res.status(400).json({ error: '名额限制必须为正整数' });
  }
  const info = db.prepare(`
    INSERT INTO tasks (title, description, reward_points, max_completions)
    VALUES (?, ?, ?, ?)
  `).run(title.trim(), String(description), points, max);
  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid));
});

// 更新任务（标题/描述/奖励/名额）
app.put('/api/ops/tasks/:id', (req, res) => {
  if (!requireOps(req, res)) return;
  const task = getTaskOr404(req, res);
  if (!task) return;
  const { title, description, reward_points, max_completions } = req.body || {};
  if (title !== undefined && (!title || !String(title).trim())) {
    return res.status(400).json({ error: '任务标题不能为空' });
  }
  const points = reward_points === undefined ? task.reward_points : Number(reward_points);
  if (!Number.isInteger(points) || points <= 0) {
    return res.status(400).json({ error: '奖励积分必须为正整数' });
  }
  const max = max_completions === undefined ? task.max_completions
    : (max_completions == null || max_completions === '' ? null : Number(max_completions));
  if (max != null && (!Number.isInteger(max) || max <= 0)) {
    return res.status(400).json({ error: '名额限制必须为正整数' });
  }
  db.prepare(`
    UPDATE tasks SET title = ?, description = ?, reward_points = ?, max_completions = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title === undefined ? task.title : String(title).trim(),
    description === undefined ? task.description : String(description),
    points,
    max,
    task.id
  );
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id));
});

// 上架 / 下架
app.post('/api/ops/tasks/:id/status', (req, res) => {
  if (!requireOps(req, res)) return;
  const task = getTaskOr404(req, res);
  if (!task) return;
  const { status } = req.body || {};
  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'status 只能是 active 或 inactive' });
  }
  db.prepare("UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, task.id);
  res.json({ message: status === 'active' ? '任务已上架' : '任务已下架' });
});

// 任务的完成 / 领取明细
app.get('/api/ops/tasks/:id/records', (req, res) => {
  if (!requireOps(req, res)) return;
  const task = getTaskOr404(req, res);
  if (!task) return;
  const completions = db.prepare(`
    SELECT c.id, u.username, c.completed_at
    FROM completions c JOIN users u ON u.id = c.user_id
    WHERE c.task_id = ? ORDER BY c.id DESC
  `).all(task.id);
  const claims = db.prepare(`
    SELECT cl.id, u.username, cl.points, cl.claimed_at
    FROM claims cl JOIN users u ON u.id = cl.user_id
    WHERE cl.task_id = ? ORDER BY cl.id DESC
  `).all(task.id);
  res.json({ task: { id: task.id, title: task.title }, completions, claims });
});

// 全局记录流水（运营看板）
app.get('/api/ops/records', (req, res) => {
  if (!requireOps(req, res)) return;
  const completions = db.prepare(`
    SELECT c.id, u.username, t.title AS task_title, c.completed_at
    FROM completions c JOIN users u ON u.id = c.user_id JOIN tasks t ON t.id = c.task_id
    ORDER BY c.id DESC LIMIT 100
  `).all();
  const claims = db.prepare(`
    SELECT cl.id, u.username, t.title AS task_title, cl.points, cl.claimed_at
    FROM claims cl JOIN users u ON u.id = cl.user_id JOIN tasks t ON t.id = cl.task_id
    ORDER BY cl.id DESC LIMIT 100
  `).all();
  res.json({ completions, claims });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`Task Reward Center API listening on http://localhost:${PORT}`);
});
