import { useEffect, useState } from 'react';
import { api } from '../api.js';
import TaskForm from './TaskForm.jsx';

export default function OpsView() {
  const [tasks, setTasks] = useState([]);
  const [records, setRecords] = useState({ completions: [], claims: [] });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [t, r] = await Promise.all([api.opsTasks(), api.opsRecords()]);
    setTasks(t);
    setRecords(r);
  }

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);

  async function run(fn, okMsg) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await fn();
      setNotice(okMsg);
      await refresh();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(id) {
    setDetailId(id);
    setDetail(null);
    try {
      setDetail(await api.taskRecords(id));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="ops-view">
      <div className="ops-header">
        <h2>任务管理</h2>
        <button className="primary" onClick={() => { setShowCreate(true); setEditingId(null); }}>+ 新建任务</button>
      </div>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner success">{notice}</div>}

      {showCreate && (
        <section className="panel">
          <h3>新建任务</h3>
          <TaskForm
            busy={busy}
            onCancel={() => setShowCreate(false)}
            onSubmit={(data) => run(() => api.createTask(data), '任务创建成功').then((ok) => ok && setShowCreate(false))}
          />
        </section>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>任务</th><th>奖励</th><th>名额</th><th>状态</th>
            <th>完成/领取</th><th>已发放积分</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className={t.status === 'inactive' ? 'inactive' : ''}>
              {editingId === t.id ? (
                <td colSpan={7}>
                  <TaskForm
                    initial={{ title: t.title, description: t.description, reward_points: t.reward_points, max_completions: t.max_completions ?? '' }}
                    busy={busy}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(data) => run(() => api.updateTask(t.id, data), '任务已更新').then((ok) => ok && setEditingId(null))}
                  />
                </td>
              ) : (
                <>
                  <td>{t.title}<div className="muted small">{t.description}</div></td>
                  <td>{t.reward_points}</td>
                  <td>{t.max_completions == null ? '不限' : `${t.completion_count}/${t.max_completions}`}</td>
                  <td><span className={`badge ${t.status}`}>{t.status === 'active' ? '上架中' : '已下架'}</span></td>
                  <td>{t.completion_count} / {t.claim_count}</td>
                  <td>{t.claimed_points}</td>
                  <td className="actions">
                    <button onClick={() => { setEditingId(t.id); setShowCreate(false); }}>编辑</button>
                    <button onClick={() => openDetail(t.id)}>记录</button>
                    <button
                      className={t.status === 'active' ? 'danger' : 'primary'}
                      disabled={busy}
                      onClick={() => run(() => api.setTaskStatus(t.id, t.status === 'active' ? 'inactive' : 'active'), t.status === 'active' ? '任务已下架' : '任务已上架')}
                    >
                      {t.status === 'active' ? '下架' : '上架'}
                    </button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {detailId && (
        <section className="panel">
          <div className="ops-header">
            <h3>任务明细：{detail?.task.title ?? '加载中…'}</h3>
            <button onClick={() => { setDetailId(null); setDetail(null); }}>关闭</button>
          </div>
          {detail && (
            <div className="detail-grid">
              <div>
                <h4>完成记录（{detail.completions.length}）</h4>
                <table className="table">
                  <thead><tr><th>用户</th><th>完成时间</th></tr></thead>
                  <tbody>
                    {detail.completions.map((c) => <tr key={c.id}><td>{c.username}</td><td>{c.completed_at}</td></tr>)}
                  </tbody>
                </table>
              </div>
              <div>
                <h4>领取记录（{detail.claims.length}）</h4>
                <table className="table">
                  <thead><tr><th>用户</th><th>积分</th><th>领取时间</th></tr></thead>
                  <tbody>
                    {detail.claims.map((c) => <tr key={c.id}><td>{c.username}</td><td>+{c.points}</td><td>{c.claimed_at}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="panel">
        <h3>最近动态（完成 / 领取流水）</h3>
        <div className="detail-grid">
          <div>
            <h4>最近完成</h4>
            <table className="table">
              <thead><tr><th>用户</th><th>任务</th><th>时间</th></tr></thead>
              <tbody>
                {records.completions.map((c) => <tr key={`c${c.id}`}><td>{c.username}</td><td>{c.task_title}</td><td>{c.completed_at}</td></tr>)}
              </tbody>
            </table>
          </div>
          <div>
            <h4>最近领取</h4>
            <table className="table">
              <thead><tr><th>用户</th><th>任务</th><th>积分</th><th>时间</th></tr></thead>
              <tbody>
                {records.claims.map((c) => <tr key={`cl${c.id}`}><td>{c.username}</td><td>{c.task_title}</td><td>+{c.points}</td><td>{c.claimed_at}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
