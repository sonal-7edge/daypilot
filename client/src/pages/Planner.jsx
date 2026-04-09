import React, { useState } from 'react'
import dayjs from 'dayjs'
import { useApi, apiFetch } from '../hooks/useApi'
import './Planner.css'

export default function Planner() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const { data, loading, error, setData } = useApi(`/api/planner/day?date=${date}`, [date])

  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState('meeting') // meeting | focus
  const [form, setForm] = useState({ title: '', jiraKey: '', start: '09:00', end: '10:00', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')

  const { data: rooms } = useApi('/api/calendar/rooms')
  const [roomEmail, setRoomEmail] = useState('')

  function todayLabel() {
    const d = dayjs(date)
    if (d.isSame(dayjs(), 'day')) return 'Today'
    if (d.isSame(dayjs().add(1, 'day'), 'day')) return 'Tomorrow'
    return d.format('ddd, D MMM')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setMsg('')
    try {
      const endpoint = formType === 'focus' ? '/api/calendar/focus' : '/api/calendar/event'
      const tz = '+05:30'
      const payload = {
        title: form.title,
        start: `${date}T${form.start}:00${tz}`,
        end: `${date}T${form.end}:00${tz}`,
        description: form.description,
        ...(formType === 'meeting' && form.jiraKey && { jiraKey: form.jiraKey }),
        ...(formType === 'meeting' && roomEmail && { roomResourceEmail: roomEmail }),
      }
      await apiFetch(endpoint, { method: 'POST', body: payload })
      setMsg('Added to calendar!')
      setShowForm(false)
      setForm({ title: '', jiraKey: '', start: '09:00', end: '10:00', description: '' })
      // Refresh
      const fresh = await apiFetch(`/api/planner/day?date=${date}`)
      setData(fresh)
    } catch (err) {
      setMsg(`Error: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  function fmtTime(iso) {
    return dayjs(iso).format('HH:mm')
  }

  function eventColor(ev) {
    const t = (ev.summary || '').toLowerCase()
    if (t.includes('focus')) return 'teal'
    if (t.includes('standup') || t.includes('sync') || t.includes('meeting')) return 'blue'
    return 'purple'
  }

  return (
    <div className="planner">
      {/* Header */}
      <div className="planner-header">
        <div className="planner-title">
          <h1>{todayLabel()}</h1>
          <span className="planner-date">{dayjs(date).format('dddd, MMMM D')}</span>
        </div>
        <div className="planner-controls">
          <button className="btn-ghost" onClick={() => setDate(dayjs(date).subtract(1, 'day').format('YYYY-MM-DD'))}>←</button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="date-pick" />
          <button className="btn-ghost" onClick={() => setDate(dayjs(date).add(1, 'day').format('YYYY-MM-DD'))}>→</button>
          <button className="btn-accent" onClick={() => { setShowForm(true); setFormType('meeting') }}>+ Meeting</button>
          <button className="btn-outline" onClick={() => { setShowForm(true); setFormType('focus') }}>+ Focus</button>
        </div>
      </div>

      {msg && <div className="toast">{msg}</div>}

      {/* Add Event Form */}
      {showForm && (
        <div className="form-panel">
          <div className="form-panel-header">
            <div className="form-tabs">
              <button className={formType === 'meeting' ? 'tab active' : 'tab'} onClick={() => setFormType('meeting')}>Meeting</button>
              <button className={formType === 'focus' ? 'tab active' : 'tab'} onClick={() => setFormType('focus')}>Focus Block</button>
            </div>
            <button className="btn-ghost" onClick={() => setShowForm(false)}>✕</button>
          </div>
          <form onSubmit={handleSubmit} className="event-form">
            {formType === 'meeting' && (
              <input
                placeholder="Jira key (e.g. ZZ-2140) — auto-fills title"
                value={form.jiraKey}
                onChange={e => setForm({ ...form, jiraKey: e.target.value })}
              />
            )}
            <input
              placeholder={formType === 'focus' ? 'Focus block title' : 'Event title (optional if Jira key given)'}
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
            <div className="form-row">
              <input type="time" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} />
              <span className="form-sep">→</span>
              <input type="time" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} />
            </div>
            {formType === 'meeting' && rooms?.length > 0 && (
              <select value={roomEmail} onChange={e => setRoomEmail(e.target.value)}>
                <option value="">No room</option>
                {rooms.map(r => (
                  <option key={r.resourceId} value={r.resourceEmail}>{r.resourceName}</option>
                ))}
              </select>
            )}
            <textarea
              placeholder="Description (optional)"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
            <button type="submit" className="btn-accent" disabled={submitting}>
              {submitting ? 'Adding...' : formType === 'focus' ? 'Block Focus Time' : 'Add to Calendar'}
            </button>
          </form>
        </div>
      )}

      {loading && <div className="state-msg">Loading...</div>}
      {error && <div className="state-msg error">{error}</div>}

      {data && (
        <div className="planner-body">
          {/* Timeline */}
          <div className="section">
            <div className="section-label">Schedule</div>
            {data.events?.length === 0 && <div className="empty">No events today</div>}
            <div className="event-list">
              {data.events?.map(ev => (
                <div key={ev.id} className={`event-card color-${eventColor(ev)}`}>
                  <div className="event-time">{fmtTime(ev.start?.dateTime || ev.start?.date)} – {fmtTime(ev.end?.dateTime || ev.end?.date)}</div>
                  <div className="event-title">{ev.summary}</div>
                  {ev.description && <div className="event-desc">{ev.description.split('\n')[0]}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Free slots */}
          {data.freeSlots?.length > 0 && (
            <div className="section">
              <div className="section-label">Free Slots</div>
              <div className="slot-list">
                {data.freeSlots.map((s, i) => (
                  <div key={i} className="slot-card" onClick={() => {
                    setForm({ ...form, start: dayjs(s.start).format('HH:mm'), end: dayjs(s.end).format('HH:mm') })
                    setShowForm(true)
                  }}>
                    <span>{fmtTime(s.start)} – {fmtTime(s.end)}</span>
                    <span className="slot-dur">{s.durationMinutes}m free</span>
                    <span className="slot-cta">+ book</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Jira issues */}
          <div className="section">
            <div className="section-label">My Sprint Issues</div>
            {data.issues?.length === 0 && <div className="empty">No open issues</div>}
            <div className="issue-list">
              {data.issues?.map(issue => {
                const spent = issue.fields.timespent ? `${Math.round(issue.fields.timespent / 3600)}h` : '0h'
                const est = issue.fields.timeoriginalestimate ? `${Math.round(issue.fields.timeoriginalestimate / 3600)}h` : '—'
                const pct = issue.fields.timeoriginalestimate && issue.fields.timespent
                  ? Math.min(100, Math.round((issue.fields.timespent / issue.fields.timeoriginalestimate) * 100))
                  : 0
                return (
                  <div key={issue.id} className="issue-card">
                    <div className="issue-top">
                      <span className="issue-key">{issue.key}</span>
                      <span className={`issue-status status-${issue.fields.status.name.toLowerCase().replace(/\s/g, '-')}`}>
                        {issue.fields.status.name}
                      </span>
                    </div>
                    <div className="issue-summary">{issue.fields.summary}</div>
                    <div className="issue-meta">
                      <span>{spent} / {est}</span>
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
