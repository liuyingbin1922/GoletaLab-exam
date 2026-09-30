let currentUserId = null;

export function setCurrentUser(id) {
  currentUserId = id;
}

async function request(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(currentUserId ? { 'x-user-id': String(currentUserId) } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `请求失败（${res.status}）`);
  return body;
}

export const api = {
  users: () => request('/api/users'),
  summary: () => request('/api/me/summary'),
  myClaims: () => request('/api/me/claims'),
  tasks: () => request('/api/tasks'),
  completeTask: (id) => request(`/api/tasks/${id}/complete`, { method: 'POST' }),
  claimTask: (id) => request(`/api/tasks/${id}/claim`, { method: 'POST' }),

  opsTasks: () => request('/api/ops/tasks'),
  createTask: (data) => request('/api/ops/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id, data) => request(`/api/ops/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setTaskStatus: (id, status) => request(`/api/ops/tasks/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  taskRecords: (id) => request(`/api/ops/tasks/${id}/records`),
  opsRecords: () => request('/api/ops/records'),
};
