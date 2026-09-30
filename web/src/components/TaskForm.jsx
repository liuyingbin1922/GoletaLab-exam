import { useState } from 'react';

const EMPTY = { title: '', description: '', reward_points: '', max_completions: '' };

export default function TaskForm({ initial, onSubmit, onCancel, busy }) {
  const [form, setForm] = useState(initial || EMPTY);

  function update(key) {
    return (e) => setForm({ ...form, [key]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      title: form.title,
      description: form.description,
      reward_points: form.reward_points === '' ? undefined : Number(form.reward_points),
      max_completions: form.max_completions === '' ? null : Number(form.max_completions),
    });
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <div className="field">
        <label>任务标题 *</label>
        <input value={form.title} onChange={update('title')} required />
      </div>
      <div className="field">
        <label>任务说明</label>
        <textarea value={form.description} onChange={update('description')} rows={2} />
      </div>
      <div className="field-row">
        <div className="field">
          <label>奖励积分 *</label>
          <input type="number" min="1" value={form.reward_points} onChange={update('reward_points')} required />
        </div>
        <div className="field">
          <label>名额限制（留空不限）</label>
          <input type="number" min="1" value={form.max_completions} onChange={update('max_completions')} />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="primary" disabled={busy}>{busy ? '提交中…' : '保存'}</button>
        {onCancel && <button type="button" onClick={onCancel}>取消</button>}
      </div>
    </form>
  );
}
