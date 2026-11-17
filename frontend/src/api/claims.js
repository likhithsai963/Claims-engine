/**
 * POST /api/claims/assess
 * Resolves with the saved assessment, or throws an Error whose message is
 * safe to show to the user.
 */
export async function assessClaim({ productName, claimText, evidence }) {
  let response
  try {
    response = await fetch('/api/claims/assess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productName, claimText, evidence }),
    })
  } catch {
    throw new Error('Cannot reach the server. Is the backend running?')
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    // NestJS validation errors arrive as an array of messages.
    const message = Array.isArray(data?.message)
      ? data.message.join('. ')
      : data?.message
    throw new Error(message || `Request failed (${response.status})`)
  }

  return data
}
