import { useState } from 'react'
import { assessClaim } from '../api/claims'
import AssessmentResult from './AssessmentResult'

const EMPTY = { productName: '', claimText: '', evidence: '' }

const EXAMPLE = {
  productName: 'Age Renewal Serum',
  claimText: 'Reduces wrinkles by 20% in 4 weeks',
  evidence:
    'Randomised, double-blind, placebo-controlled study. 62 women aged 40-65 applied the serum twice daily. ' +
    "Crow's-feet wrinkle depth measured by 3D profilometry at baseline and week 4. " +
    'Mean reduction in wrinkle depth: 23.4% vs 3.1% for placebo (p < 0.001).',
}

export default function ClaimAssessment() {
  const [form, setForm] = useState(EMPTY)
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const loading = status === 'loading'
  const complete = Object.values(form).every((value) => value.trim() !== '')

  function update(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus('loading')
    setError('')
    try {
      setResult(await assessClaim(form))
      setStatus('done')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  return (
    <div className="assessment">
      <form className="panel" onSubmit={handleSubmit}>
        <div className="panel-head">
          <h2>Claim &amp; evidence</h2>
          <button
            type="button"
            className="link"
            onClick={() => setForm(EXAMPLE)}
            disabled={loading}
          >
            Load example
          </button>
        </div>

        <label>
          Product
          <input
            name="productName"
            value={form.productName}
            onChange={update}
            maxLength={200}
            placeholder="e.g. Age Renewal Serum"
            disabled={loading}
          />
        </label>

        <label>
          Proposed claim
          <input
            name="claimText"
            value={form.claimText}
            onChange={update}
            maxLength={500}
            placeholder="e.g. Reduces wrinkles by 20% in 4 weeks"
            disabled={loading}
          />
        </label>

        <label>
          Clinical study evidence
          <textarea
            name="evidence"
            value={form.evidence}
            onChange={update}
            maxLength={20000}
            rows={8}
            placeholder="Paste the study design and results: sample size, method, measured effect, timeframe, significance…"
            disabled={loading}
          />
        </label>

        <button type="submit" className="primary" disabled={loading || !complete}>
          {loading ? 'Assessing…' : 'Assess claim'}
        </button>
      </form>

      <section className="panel" aria-live="polite" aria-busy={loading}>
        <div className="panel-head">
          <h2>Assessment</h2>
        </div>

        {status === 'idle' && (
          <p className="muted">
            Submit a claim with its study evidence to see whether the evidence
            justifies it.
          </p>
        )}
        {loading && <p className="muted">Reviewing the evidence against the claim…</p>}
        {status === 'error' && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {status === 'done' && <AssessmentResult result={result} />}
      </section>
    </div>
  )
}
