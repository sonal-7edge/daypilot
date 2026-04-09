import React, { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import { useApi, apiFetch } from '../hooks/useApi'
import './Tempo.css'

function getWeekRange() {
  const now = dayjs()
  return {
    from: now.startOf('week').add(1, 'day').format('YYYY-MM-DD'),
    to: now.endOf('week').add(1, 'day').format('YYYY-MM-DD'),
  }
}

export default function Tempo() {
  const [range, setRange] = useState(getWeekRange())
  const { data, loading, error, setData } = useApi(
    `/api/tempo/worklogs?from=${range.from}&to=${range.to}`,
    [range.from, range.to]
  )

  const [logForm, setLogForm] = useState({ issueKey: '', hours: '', date: dayjs().format('YYYY-MM-DD'), description: '' })
  const [logMsg, setLogMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [managerEmail, setManagerEmail] = useState('')
  const [showPublish, setShowPublish] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editHours, setEditHours] = useState('')

  async function refresh() {
    const fresh = await apiFetch(`/api/tempo/worklogs?from=${range.from}&to=${range.to}`)
    setData(fresh)
  }

  async function handleLog(e) {
    e.preventDefault()
    setSubmitting(true)
    setLogMsg('')
    try {
      await apiFetch('/api/tempo/log', {
        method: 'POST',
        body: {
          issueKey: logForm.issueKey,
          timeSpentSeconds: Math.round(parseFloat(logForm.hours) * 3600),
          startDate: logForm.date,
          description: logForm.description,
        }
      })
      setLogMsg('Logged!')
      setLogForm({ issueKey: '', hours: '', date: dayjs().format('YYYY-MM-DD'), description: '' })
      await refresh()
    } catch (err) {
      setLogMsg(`Error: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this worklog?')) return
    try {
      await apiFetch(`/api/tempo/log/${id}`, { method: 'DELETE' })
      await refresh()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleEdit(id) {
    try {
      const log = data.logs.find(l => l.tempoWorklogId === id)
      await apiFetch(`/api/tempo/log/${id}`, {
        method: 'PUT',
        body: {
          timeSpentSeconds: Math.round(parseFloat(editHours) * 3600),
          startDate: log.startDate,
          description: log.description,
        }
      })
      setEditId(null)
      await refresh()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handlePublish() {
    setPublishing(true)
    try {
      await apiFetch('/api/tempo/submit', {
        method: 'POST',
        body: { from: range.from, to: range.to, managerEmail }
      })
      setShowPublish(false)
      setLogMsg('Timesheet submitted and email sent!')
    } catch (err) {
      setLogMsg(`Error: ${err.message}`)
    } finally {
      setPublishing(false)
    }
  }

  const totalHours = data?.summary?.reduce((acc, s) => acc + s.hours, 0).toFixed(1) || '0'

  return (
    <div className="tempo">
      <div className="tempo-header">
        <div>
          <h1>Tempo</h1>
          <span className="planner-date">Time tracking & timesheet</span>
        </div>
        <div className="tempo-controls">
          <input type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} className="date-pick" />
          <span style={{ color: 'var(--text3)' }}>→</span>
          <input type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} className="date-pick" />
          <button className="btn-ghost" onClick={() => setRange(getWeekRange())}>This week</button>
          <button className="btn-accent publish-btn" onClick={() => setShowPublish(true)}>Publish</button>
        </div>
      </div>

      {logMsg && <div className="toast">{logMsg}</div>}

      {/* Publish modal */}
      {showPublish && (
        <div className="publish-panel">
          <div className="form-panel-header">
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>Submit Timesheet</span>
            <button className="btn-ghost" onClick={() => setShowPublish(false)}>✕</button>
          </div>
          <p style={{ color: 'var(--text2)', fontSize: 12, marginBottom: 12 }}>
            Period: {range.from} → {range.to} · Total: {totalHours}h
          </p>
          <input
            placeholder="Manager email (for summary)"
            value={managerEmail}
            onChange={e => setManagerEmail(e.target.value)}
            style={{ width: '100%', marginBottom: 12 }}
          />
          <button className="btn-accent" onClick={handlePublish} disabled={publishing} style={{ width: '100%' }}>
            {publishing ? 'Submitting...' : 'Submit & Send Email'}
          </button>
        </div>
      )}

      {/* Log time form */}
      <div className="log-form-panel">
        <div className="section-label">Log Time</div>
        <form onSubmit={handleLog} className="log-form">
          <input
            placeholder="Issue key (e.g. ZZ-2140)"
            value={logForm.issueKey}
            onChange={e => setLogForm({ ...logForm, issueKey: e.target.value })}
            required
            style={{ flex: 2 }}
          />
          <input
            placeholder="Hours (e.g. 1.5)"
            type="number"
            step="0.25"
            min="0.25"
            value={logForm.hours}
            onChange={e => setLogForm({ ...logForm, hours: e.target.value })}
            required
            style={{ flex: 1 }}
          />
          <input
            type="date"
            value={logForm.date}
            onChange={e => setLogForm({ ...logForm, date: e.target.value })}
            className="date-pick"
            style={{ flex: 1 }}
          />
          <input
            placeholder="Description"
            value={logForm.description}
            onChange={e => setLogForm({ ...logForm, description: e.target.value })}
            style={{ flex: 3 }}
          />
          <button type="submit" className="btn-accent" disabled={submitting}>
            {submitting ? '...' : 'Log'}
          </button>
        </form>
      </div>

      {loading && <div className="state-msg">Loading worklogs...</div>}
      {error && <div className="state-msg error">{error}</div>}

      {data && (
        <div className="tempo-body">
          {/* Summary */}
          <div className="summary-row">
            <div className="summary-card">
              <span className="summary-val">{totalHours}h</span>
              <span className="summary-label">Total logged</span>
            </div>
            <div className="summary-card">
              <span className="summary-val">{data.summary?.length || 0}</span>
              <span className="summary-label">Issues worked</span>
            </div>
            <div className="summary-card">
              <span className="summary-val">{data.logs?.length || 0}</span>
              <span className="summary-label">Worklogs</span>
            </div>
          </div>

          {/* By issue */}
          {data.summary?.length > 0 && (
            <div className="section">
              <div className="section-label">By Issue</div>
              <div className="summary-list">
                {data.summary.map(s => {
                  const maxH = Math.max(...data.summary.map(x => x.hours))
                  const pct = Math.round((s.hours / maxH) * 100)
                  return (
                    <div key={s.key} className="summary-issue">
                      <div className="si-top">
                        <span className="issue-key">{s.key}</span>
                        <span className="si-hours">{s.hours}h</span>
                      </div>
                      {s.summary && <div className="si-title">{s.summary}</div>}
                      <div className="progress-bar" style={{ marginTop: 6 }}>
                        <div className="progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Individual worklogs */}
          <div className="section">
            <div className="section-label">All Worklogs</div>
            {data.logs?.length === 0 && <div className="empty">No worklogs for this period</div>}
            <div className="worklog-list">
              {data.logs?.map(log => (
                <div key={log.tempoWorklogId} className="worklog-row">
                  <div className="wl-left">
                    <span className="issue-key">{log.issue?.key || '—'}</span>
                    <span className="wl-date">{log.startDate}</span>
                  </div>
                  <div className="wl-desc">{log.description || <span style={{ color: 'var(--text3)' }}>no description</span>}</div>
                  <div className="wl-right">
                    {editId === log.tempoWorklogId ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="number"
                          step="0.25"
                          value={editHours}
                          onChange={e => setEditHours(e.target.value)}
                          style={{ width: 70 }}
                          placeholder="hrs"
                        />
                        <button className="btn-accent" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => handleEdit(log.tempoWorklogId)}>Save</button>
                        <button className="btn-ghost" onClick={() => setEditId(null)}>✕</button>
                      </div>
                    ) : (
                      <>
                        <span className="wl-hours">{(log.timeSpentSeconds / 3600).toFixed(1)}h</span>
                        <button className="wl-btn" onClick={() => { setEditId(log.tempoWorklogId); setEditHours((log.timeSpentSeconds / 3600).toFixed(1)) }}>edit</button>
                        <button className="wl-btn danger" onClick={() => handleDelete(log.tempoWorklogId)}>del</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
