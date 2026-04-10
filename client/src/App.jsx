import { useState, useEffect } from 'react'
import './App.css'

const REDIRECT_URI = window.location.origin
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/admin.directory.resource.calendar.readonly',
].join(' ')

const STEPS = [
  { id: 'welcome',   label: 'Welcome' },
  { id: 'google',    label: 'Google Cloud' },
  { id: 'atlassian', label: 'Atlassian' },
  { id: 'tempo',     label: 'Tempo' },
  { id: 'token',     label: 'Your Token' },
]

const EMPTY_FORM = {
  googleClientId: '',
  googleClientSecret: '',
  googleRefreshToken: '',
  googleCalendarId: 'primary',
  jiraEmail: '',
  jiraApiToken: '',
  tempoApiToken: '',
  tempoAccountId: '',
}

// ── tiny helpers ──────────────────────────────────────────────────────────────

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback }
  catch { return fallback }
}

function A({ href, children }) {
  return <a href={href} target="_blank" rel="noreferrer" className="link">{children}</a>
}

function StatusBox({ status }) {
  if (!status.message) return null
  return <div className={`status status--${status.type}`}>{status.message}</div>
}

function Field({ label, hint, type = 'text', value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  const secret = type === 'password'
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      {hint && <p className="field-hint">{hint}</p>}
      <div className="field-row">
        <input
          className="input"
          type={secret && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        {secret && (
          <button type="button" className="show-btn" onClick={() => setShow(s => !s)}>
            {show ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
    </div>
  )
}

function CopyBox({ label, value }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="copy-box">
      {label && <p className="copy-label">{label}</p>}
      <div className="copy-inner">
        <pre className="copy-text">{value}</pre>
        <button className="copy-btn" onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
      </div>
    </div>
  )
}

// ── step components ───────────────────────────────────────────────────────────

function StepWelcome({ onNext }) {
  return (
    <div className="step">
      <div className="welcome-hero">
        <div className="welcome-logo">⚡</div>
        <h1 className="welcome-title">Daypilot Setup</h1>
        <p className="welcome-sub">
          Connect your Google Calendar, Jira, and Tempo in 4 steps.
          You'll get a personal token to use with the Daypilot MCP server in Claude.
        </p>
      </div>

      <div className="feature-grid">
        {[
          { icon: '📅', title: 'Google Calendar', desc: 'Create focus blocks and meetings directly from Claude' },
          { icon: '🎯', title: 'Jira', desc: 'Browse sprint cards and link them to time entries' },
          { icon: '⏱', title: 'Tempo', desc: 'Time is logged automatically whenever you create an event' },
        ].map(f => (
          <div className="feature-card" key={f.title}>
            <span className="feature-icon">{f.icon}</span>
            <div>
              <p className="feature-title">{f.title}</p>
              <p className="feature-desc">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" onClick={onNext}>Get started →</button>
    </div>
  )
}

function StepGoogle({ form, set, onNext, status, setStatus, loading }) {
  const connected = !!form.googleRefreshToken

  function connect() {
    if (!form.googleClientId.trim() || !form.googleClientSecret.trim()) {
      setStatus({ type: 'error', message: 'Enter your Client ID and Client Secret first.' })
      return
    }
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id',     form.googleClientId.trim())
    url.searchParams.set('redirect_uri',  REDIRECT_URI)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope',         GOOGLE_SCOPES)
    url.searchParams.set('access_type',   'offline')
    url.searchParams.set('prompt',        'consent')
    url.searchParams.set('state',         'daypilot-google')
    window.location.href = url.toString()
  }

  return (
    <div className="step">
      <h2 className="step-title">Google Cloud</h2>
      <p className="step-desc">Daypilot needs OAuth access to read and create Google Calendar events.</p>

      <div className="callout">
        <p className="callout-title">How to get your credentials</p>
        <ol>
          <li>Go to <A href="https://console.cloud.google.com">console.cloud.google.com</A> → create a project (e.g. <strong>Daypilot</strong>)</li>
          <li>Enable: <strong>Google Calendar API</strong> and <strong>Admin SDK API</strong></li>
          <li>Go to <strong>Credentials → Create Credentials → OAuth 2.0 Client ID</strong></li>
          <li>Application type: <strong>Web application</strong></li>
          <li>Add this as an <strong>Authorised Redirect URI</strong>:<br />
            <code className="code">{REDIRECT_URI}</code>
          </li>
          <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong></li>
        </ol>
      </div>

      <Field label="Client ID" value={form.googleClientId} onChange={v => set('googleClientId', v)} placeholder="xxxx.apps.googleusercontent.com" />
      <Field label="Client Secret" type="password" value={form.googleClientSecret} onChange={v => set('googleClientSecret', v)} placeholder="GOCSPX-..." />
      <Field
        label="Calendar ID"
        hint='Use "primary" for your default calendar, or paste a specific calendar ID.'
        value={form.googleCalendarId}
        onChange={v => set('googleCalendarId', v)}
        placeholder="primary"
      />

      <StatusBox status={status} />

      {connected ? (
        <div className="connected">
          <span className="connected-dot" /> Google Calendar connected ✓
          <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={onNext}>Continue →</button>
        </div>
      ) : (
        <button className="btn btn-google" onClick={connect} disabled={loading}>
          <GoogleIcon />
          {loading ? 'Connecting…' : 'Connect Google Account'}
        </button>
      )}
    </div>
  )
}

function StepAtlassian({ form, set, onNext, status, setStatus }) {
  function next() {
    if (!form.jiraEmail.trim() || !form.jiraApiToken.trim() || !form.tempoAccountId.trim()) {
      setStatus({ type: 'error', message: 'All three fields are required.' })
      return
    }
    setStatus({ type: '' })
    onNext()
  }

  return (
    <div className="step">
      <h2 className="step-title">Atlassian Jira</h2>
      <p className="step-desc">An API token lets Daypilot fetch your sprint cards and link time entries to issues.</p>

      <div className="callout">
        <p className="callout-title">How to get your credentials</p>
        <ol>
          <li>Go to <A href="https://id.atlassian.com/manage-profile/security/api-tokens">id.atlassian.com → Security → API tokens</A></li>
          <li>Click <strong>Create API token</strong>, name it <strong>daypilot</strong>, and copy it</li>
          <li>To find your <strong>Account ID</strong> — ask Claude:<br />
            <code className="code">Ask Claude: "What is my Jira account ID?" using the Atlassian integration</code>
          </li>
        </ol>
      </div>

      <div className="status status--info" style={{ marginBottom: 20 }}>
        <strong>Tip:</strong> Open Claude and use the built-in Atlassian integration to run{' '}
        <code className="code">atlassianUserInfo</code> — it will give you your Account ID instantly. Copy and paste it below.
      </div>

      <Field label="Atlassian Account Email" value={form.jiraEmail} onChange={v => set('jiraEmail', v)} placeholder="you@company.com" />
      <Field label="API Token" type="password" value={form.jiraApiToken} onChange={v => set('jiraApiToken', v)} placeholder="Paste your token" />
      <Field
        label="Account ID"
        hint="Get this from Claude's Atlassian integration or from your Jira profile URL."
        value={form.tempoAccountId}
        onChange={v => set('tempoAccountId', v)}
        placeholder="5b10a2844c20165700ede21g"
      />

      <StatusBox status={status} />

      <button className="btn btn-primary" onClick={next}>Continue →</button>
    </div>
  )
}

function StepTempo({ form, set, onNext, status, setStatus }) {
  function next() {
    if (!form.tempoApiToken.trim()) {
      setStatus({ type: 'error', message: 'Tempo API token is required.' })
      return
    }
    setStatus({ type: '' })
    onNext()
  }

  return (
    <div className="step">
      <h2 className="step-title">Tempo Timesheets</h2>
      <p className="step-desc">Daypilot logs time in Tempo automatically when you create focus blocks or meetings.</p>

      <div className="callout">
        <p className="callout-title">How to generate your Tempo API token</p>
        <ol>
          <li>In Jira, go to <strong>Apps → Tempo Timesheets</strong></li>
          <li>Click your avatar (top-right) → <strong>Settings → API Integration</strong></li>
          <li>Click <strong>New Token</strong>, name it <strong>daypilot</strong>, and copy it</li>
        </ol>
      </div>

      <Field label="Tempo API Token" type="password" value={form.tempoApiToken} onChange={v => set('tempoApiToken', v)} placeholder="Paste your Tempo token" />

      <StatusBox status={status} />
      <button className="btn btn-primary" onClick={next}>Continue →</button>
    </div>
  )
}


function StepToken({ form, onRestart }) {
  const token = btoa(JSON.stringify({
    GOOGLE_CLIENT_ID:     form.googleClientId,
    GOOGLE_CLIENT_SECRET: form.googleClientSecret,
    GOOGLE_REFRESH_TOKEN: form.googleRefreshToken,
    GOOGLE_CALENDAR_ID:   form.googleCalendarId || 'primary',
    JIRA_EMAIL:           form.jiraEmail,
    JIRA_API_TOKEN:       form.jiraApiToken,
    TEMPO_API_TOKEN:      form.tempoApiToken,
    TEMPO_ACCOUNT_ID:     form.tempoAccountId,
  }))

  const claudeConfig = JSON.stringify({
    mcpServers: {
      daypilot: {
        type: 'http',
        url: 'https://daypilot-mcp.onrender.com/mcp',
        headers: { 'x-daypilot-token': token },
      },
    },
  }, null, 2)

  return (
    <div className="step">
      <div className="token-hero">
        <div className="token-check">✓</div>
        <h2 className="step-title">You're all set!</h2>
        <p className="step-desc">Your personal Daypilot token is ready. Add it to Claude to start using the MCP.</p>
      </div>

      <div className="token-block">
        <div className="token-block-header">
          <p className="token-block-title">Your Token</p>
          <span className="token-warn">⚠ Keep this private — it contains all your API credentials</span>
        </div>
        <CopyBox value={token} />
      </div>

      <div className="token-block">
        <p className="token-block-title">Add to Claude Desktop</p>
        <p className="field-hint">
          Open <code className="code">~/.claude/claude_desktop_config.json</code> and paste:
        </p>
        <CopyBox value={claudeConfig} />
      </div>

      <div className="token-block">
        <p className="token-block-title">Try these prompts in Claude</p>
        <div className="chips">
          {['Log time', "What haven't I logged today?", 'Focus block for AUTH-123', 'Set my role to dev'].map(p => (
            <span className="chip" key={p}>"{p}"</span>
          ))}
        </div>
      </div>

      <button className="btn btn-outline" onClick={onRestart}>Start over</button>
    </div>
  )
}

// ── Google icon ───────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

// ── root ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [step, setStep]       = useState(() => load('dp_step', 0))
  const [form, setFormRaw]    = useState(() => load('dp_form', EMPTY_FORM))
  const [status, setStatus]   = useState({ type: '', message: '' })
  const [loading, setLoading] = useState(false)

  function set(key, val) { setFormRaw(f => ({ ...f, [key]: val })) }

  useEffect(() => { localStorage.setItem('dp_form', JSON.stringify(form)) }, [form])
  useEffect(() => { localStorage.setItem('dp_step', String(step)) }, [step])
  useEffect(() => { setStatus({ type: '', message: '' }) }, [step])

  // Google OAuth callback
  useEffect(() => {
    const p     = new URLSearchParams(window.location.search)
    const code  = p.get('code')
    const state = p.get('state')
    if (!code || state !== 'daypilot-google') return

    window.history.replaceState({}, '', window.location.pathname)
    const saved = load('dp_form', EMPTY_FORM)

    setLoading(true)
    setStatus({ type: 'info', message: 'Exchanging authorisation code with Google…' })

    fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     saved.googleClientId,
        client_secret: saved.googleClientSecret,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.refresh_token) {
          set('googleRefreshToken', data.refresh_token)
          setStep(1)
          setStatus({ type: 'success', message: 'Google Calendar connected — click Continue.' })
        } else {
          setStatus({ type: 'error', message: `Google error: ${data.error_description || data.error || 'Try again'}` })
        }
      })
      .catch(err => setStatus({ type: 'error', message: 'Token exchange failed: ' + err.message }))
      .finally(() => setLoading(false))
  }, [])

  function next()    { setStep(s => Math.min(s + 1, STEPS.length - 1)) }
  function goTo(i)   { setStep(i) }
  function restart() {
    localStorage.removeItem('dp_form')
    localStorage.removeItem('dp_step')
    setFormRaw(EMPTY_FORM)
    setStep(0)
  }

  const shared = { form, set, onNext: next, status, setStatus, loading, setLoading }

  const pages = [
    <StepWelcome    key="w" onNext={next} />,
    <StepGoogle     key="g" {...shared} />,
    <StepAtlassian  key="a" {...shared} />,
    <StepTempo      key="t" {...shared} />,
    <StepToken      key="k" form={form} onRestart={restart} />,
  ]

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">⚡ Daypilot</div>
        <nav className="nav">
          {STEPS.map((s, i) => {
            const done    = i < step
            const current = i === step
            return (
              <button
                key={s.id}
                className={`nav-item ${current ? 'is-current' : ''} ${done ? 'is-done' : ''}`}
                onClick={() => done && goTo(i)}
                disabled={!done && !current}
              >
                <span className="nav-dot">
                  {done ? '✓' : <span className="nav-num">{i + 1}</span>}
                </span>
                {s.label}
              </button>
            )
          })}
        </nav>
        <p className="sidebar-foot">Setup wizard · v1.0</p>
      </aside>

      <main className="main">
        <div className="main-inner">{pages[step]}</div>
      </main>
    </div>
  )
}
