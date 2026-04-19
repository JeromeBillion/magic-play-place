# Magic Play Place Frontend

Next.js frontend for the Magic Play Place multimodal AI experimentation laboratory.

## Run Locally

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open: `http://localhost:3000`

## Required Environment Variable

- `NEXT_PUBLIC_API_BASE_URL`
  - Example: `http://localhost:8000`
  - Used by the UI to call backend `/predict` and `/generate`.

## Optional Environment Variable

- `NEXT_PUBLIC_API_KEY`
  - Used when backend is running with `REQUIRE_API_KEY=true`.
  - Sent as `X-API-Key` on frontend API requests.

## Build for Deployment

```bash
npm run lint
npm run build
npm run start
```

The project uses Next.js standalone output for deploy-friendly packaging.
