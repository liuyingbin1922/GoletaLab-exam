import { useEffect, useState } from 'react';
import { api, setCurrentUser } from './api.js';
import UserView from './components/UserView.jsx';
import OpsView from './components/OpsView.jsx';

export default function App() {
  const [users, setUsers] = useState([]);
  const [current, setCurrent] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api.users().then((list) => {
      setUsers(list);
      if (list.length) switchUser(list[0]);
    }).catch((e) => setError(e.message));
  }, []);

  function switchUser(user) {
    setCurrent(user);
    setCurrentUser(user.id);
    setError('');
    setNotice(`已切换为 ${user.username}（${user.role === 'ops' ? '运营' : '用户'}）`);
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>任务奖励中心</h1>
        <label className="switcher">
          当前身份：
          <select value={current?.id ?? ''} onChange={(e) => switchUser(users.find((u) => u.id === Number(e.target.value)))}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}（{u.role === 'ops' ? '运营' : '用户'}）
              </option>
            ))}
          </select>
        </label>
      </header>
      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner info" onAnimationEnd={() => setNotice('')}>{notice}</div>}
      <main>
        {!current ? (
          <p className="loading">加载中…</p>
        ) : current.role === 'ops' ? (
          <OpsView />
        ) : (
          <UserView />
        )}
      </main>
    </div>
  );
}
