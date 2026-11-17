# Claims Intelligence Engine

Assesses whether clinical study evidence actually justifies a cosmetic product claim, using an LLM.

A claim (e.g. *"Reduces wrinkles by 20% in 4 weeks"*) and the study evidence go in. The engine returns **Justified: Yes/No**, a **confidence score** and the **reasoning**, saves the result, and shows it in a React UI.

## Technical proposal

| # | Document |
|---|---|
| 1 | [Business process understanding](docs/01-business-process.md) |
| 2 | [Research performed](docs/02-research.md) |
| 3 | [Technical architecture justification](docs/03-architecture.md) |
| 4 | [Product roadmap](docs/04-roadmap.md) |

## Where the three required parts live

| Part | File |
|---|---|
| Database — Prisma schema, `Claim` and `Assessment` | [backend/prisma/schema.prisma](backend/prisma/schema.prisma) |
| Backend — `POST /api/claims/assess` controller | [backend/src/claims/claims.controller.ts](backend/src/claims/claims.controller.ts) |
| Backend — service: call LLM, save, return | [backend/src/claims/claims.service.ts](backend/src/claims/claims.service.ts) |
| Backend — OpenAI call and prompt | [backend/src/llm/](backend/src/llm/) |
| Frontend — React component | [frontend/src/components/ClaimAssessment.jsx](frontend/src/components/ClaimAssessment.jsx) |

## Stack

NestJS 10 · Prisma 6 · SQLite · OpenAI API (Structured Outputs) · React 19 · Vite

## Run it

Requires Node.js 22+ and an OpenAI API key.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # then set OPENAI_API_KEY in .env
npx prisma migrate deploy   # creates the local SQLite database
npm run start:dev           # http://localhost:3000
```

### 2. Frontend (second terminal)

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

### 3. Try it

Open http://localhost:5173, click **Load example**, then **Assess claim**.

Without an API key the app still starts; the endpoint answers `503` with a message telling you to set the key.

## API

`POST /api/claims/assess`

```bash
curl -X POST http://localhost:3000/api/claims/assess \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Age Renewal Serum",
    "claimText": "Reduces wrinkles by 20% in 4 weeks",
    "evidence": "Randomised, placebo-controlled study, n=62. Wrinkle depth by 3D profilometry: 23.4% mean reduction at week 4 vs 3.1% placebo (p<0.001)."
  }'
```

Response `201`:

```json
{
  "claimId": "…",
  "assessmentId": "…",
  "productName": "Age Renewal Serum",
  "claimText": "Reduces wrinkles by 20% in 4 weeks",
  "status": "JUSTIFIED",
  "justified": true,
  "confidence": 0.9,
  "reasoning": "…",
  "model": "gpt-4o-mini",
  "assessedAt": "…"
}
```

To re-assess an existing claim with new evidence, send `{ "claimId": "…", "evidence": "…" }`. A new assessment is added; earlier ones are kept.

| Status | Meaning |
|---|---|
| 400 | Invalid body |
| 404 | Unknown `claimId` |
| 502 | LLM provider failed, refused, or returned an invalid answer |
| 503 | `OPENAI_API_KEY` not configured |

## Configuration

`backend/.env`

| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | — | Your OpenAI key |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model used for assessment |
| `DATABASE_URL` | `file:./dev.db` | SQLite file, relative to `backend/prisma/` |
| `PORT` | `3000` | API port |

## Tests

OpenAI is faked in all tests; no key or network needed.

```bash
cd backend
npm test            # 18 unit tests
npm run test:e2e    # 3 end-to-end tests (HTTP + isolated SQLite test DB)
```

## Inspect the data

```bash
cd backend && npx prisma studio
```

## Note

The verdict is AI-generated decision support. It does not replace review by a qualified person. See [known limitations](docs/03-architecture.md#known-limitations).
