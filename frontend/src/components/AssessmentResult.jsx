/** Displays one assessment: Justified Yes/No, Confidence Score, Reasoning. */
export default function AssessmentResult({ result }) {
  const { justified, confidence, reasoning, claimText, model, assessedAt } = result
  const percent = Math.round(confidence * 100)

  return (
    <div className="result">
      <p className="result-claim">“{claimText}”</p>

      <dl>
        <div>
          <dt>Justified</dt>
          <dd>
            <span className={`verdict ${justified ? 'yes' : 'no'}`}>
              {justified ? 'Yes' : 'No'}
            </span>
          </dd>
        </div>

        <div>
          <dt>Confidence score</dt>
          <dd>
            <span className="confidence-value">{percent}%</span>
            <meter min="0" max="100" value={percent} aria-label="Confidence score" />
          </dd>
        </div>

        <div className="wide">
          <dt>Reasoning</dt>
          <dd className="reasoning">{reasoning}</dd>
        </div>
      </dl>

      <p className="meta">
        Assessed by {model} · {new Date(assessedAt).toLocaleString()}
      </p>
      <p className="meta">
        AI-generated assessment. Decision support only — a qualified reviewer
        must confirm before a claim is approved.
      </p>
    </div>
  )
}
