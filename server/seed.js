const db = require('./db');

const seed = db.transaction(() => {
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount > 0) return;

  const insertUser = db.prepare('INSERT INTO users (username, role) VALUES (?, ?)');
  insertUser.run('alice', 'user');
  insertUser.run('bob', 'user');
  insertUser.run('ops_admin', 'ops');

  const insertTask = db.prepare(`
    INSERT INTO tasks (title, description, reward_points, status, max_completions)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertTask.run('每日签到', '登录应用并完成每日签到', 10, 'active', null);
  insertTask.run('完善个人资料', '填写昵称、头像等基础资料', 50, 'active', null);
  insertTask.run('邀请一位好友', '邀请好友注册并成功激活', 100, 'active', 500);
  insertTask.run('提交产品反馈', '在反馈入口提交一条有效建议', 30, 'active', null);
  insertTask.run('新手引导问卷', '完成入门问卷（已下线）', 5, 'inactive', null);
});

seed();

console.log('Seed data ready.');
