const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('user', 'ops')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reward_points INTEGER NOT NULL CHECK (reward_points > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  max_completions INTEGER,               -- NULL 表示不限制参与人数
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  task_id INTEGER NOT NULL REFERENCES tasks(id),
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, task_id)
);

CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  task_id INTEGER NOT NULL REFERENCES tasks(id),
  points INTEGER NOT NULL,
  claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, task_id)
);
`);

module.exports = db;
