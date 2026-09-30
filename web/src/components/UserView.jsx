import { useEffect, useState } from 'react';
import { api } from '../api.js';

const STATUS_LABEL = {
  available: '可参与',
  completed: '已完成，待领取',
  claimed: '已领取',
};

export default function UserView() {
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [claims, setClaims] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  async function refresh() {
    const [t, s, c] = await Promise.all([api.tasks(), api.summary(), api.myClaims()]);
    setTasks(t);
    setSummary(s);
    setClaims(c);
  }

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);

  async function act(fn, id) {
    setError('');
    setBusyId(id);
    try {
      await fn(id);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="user-view">
      <section className="summary-cards">
        <div className="card"><span className="num">{summary?.points ?? '-'}</span><span>我的积分</span></div>
        <div className="card"><span className="num">{summary?.completed_count ?? '-'}</span><span>已完成任务</span></div>
        <div className="card"><span className="num">{summary?.claimed_count ?? '-'}</span><span>已领取奖励</span></div>
      </section>

      {error && <div className="banner error">{error}</div>}

      <h2>任务大厅</h2>
      <table className="table">
        <thead>
          <tr><th>任务</th><th>说明</th><th>奖励</th><th>名额</th><th>我的状态</th><th>操作</th></tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className={t.status === 'inactive' ? 'inactive' : ''}>
              <td>{t.title}</td>
              <td className="desc">{t.description}</td>
              <td>{t.reward_points} 积分</td>
              <td>{t.max_completions == null ? '不限' : `${t.participant_count}/${t.max_completions}`}</td>
              <td><span className={`badge ${t.my_status}`}>{STATUS_LABEL[t.my_status]}</span></td>
              <td className="actions">
                {t.status === 'active' && t.my_status === 'available' && (
                  <button disabled={busyId === t.id} onClick={() => act(api.completeTask, t.id)}>完成任务</button>
                )}
                {t.my_status === 'completed' && (
                  <button className="primary" disabled={busyId === t.id} onClick={() => act(api.claimTask, t.id)}>领取奖励</button>
                )}
                {t.status === 'inactive' && <span className="muted">已下线</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>我的领取记录</h2>
      {claims.length === 0 ? (
        <p className="muted">还没有领取过奖励</p>
      ) : (
        <table className="table">
          <thead><tr><th>任务</th><th>积分</th><th>领取时间</th></tr></thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id}><td>{c.title}</td><td>+{c.points}</td><td>{c.claimed_at}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
