// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [err, setErr] = React.useState<Error | null>(null)
  if (err) {
    return (
      <div style={{ padding: 16 }}>
        <h2>エラーが発生しました</h2>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{String(err.stack || err.message)}</pre>
      </div>
    )
  }
  return (
    <React.Suspense fallback={<div style={{padding:16}}>読み込み中…</div>}>
      <React.StrictMode>
        <App />
      </React.StrictMode>
    </React.Suspense>
  )
}

window.addEventListener('error', (e) => {
  console.error('Global error:', e.error || e.message)
})

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary><App /></ErrorBoundary>
)
