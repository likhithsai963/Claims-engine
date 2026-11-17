import ClaimAssessment from './components/ClaimAssessment'

export default function App() {
  return (
    <main>
      <header>
        <p className="eyebrow">Claims substantiation</p>
        <h1>Claims Intelligence Engine</h1>
        <p className="lede">
          Check whether a clinical study actually justifies a product claim.
        </p>
      </header>
      <ClaimAssessment />
    </main>
  )
}
