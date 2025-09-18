# Notes App — FastAPI + MongoDB + Next.js

A minimal full-stack demo showing how to build a Notes app with:
- Backend: FastAPI + Motor (async MongoDB driver)
- Database: MongoDB
- Frontend: Next.js (React) with shadcn/ui components

Features:
- CRUD endpoints (create, read, update, delete notes)
- Clean, minimal UI with loading and error states
- CORS enabled for local development
- Beginner-friendly, well-commented code

---

## Quick Start

Prerequisites:
- Node.js 18+
- Python 3.10+
- MongoDB running locally (or a connection string for Atlas)

Environment variables (optional but recommended):
- Frontend: create a file `.env.local` in the project root with:
  - `NEXT_PUBLIC_API_BASE=http://localhost:8000`
- Backend: you can export env vars or create a `.env` file in `backend` and export before running:
  - `MONGODB_URI=mongodb://localhost:27017`
  - `MONGODB_DB=notes_demo`
  - `FRONTEND_ORIGIN=http://localhost:3000`

### 0) (Optional) Run MongoDB via Docker Compose

If you don't have MongoDB installed locally, you can spin it up with Docker:

```bash
# from the project root
docker compose up -d mongo mongo-express
# MongoDB:      mongodb://localhost:27017
# Mongo Express UI: http://localhost:8081
```

You can customize backend envs by copying the example file:

```bash
cp backend/.env.example backend/.env
```

### 1) Backend (FastAPI)

Install Python deps and run the server:

```bash
# from the project root
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt

# Run FastAPI with Uvicorn (auto-reload)
./backend/run.sh
# If run.sh is not executable, do: bash backend/run.sh
```

FastAPI runs on http://localhost:8000

Available endpoints:
- GET /health
- GET /notes
- GET /notes/{id}
- POST /notes
- PUT /notes/{id}
- DELETE /notes/{id}

### 2) Frontend (Next.js)

Install Node deps and start the dev server:

```bash
npm install
npm run dev
```

Open http://localhost:3000

The frontend fetches the FastAPI API at `NEXT_PUBLIC_API_BASE` (default `http://localhost:8000`).

---

## Project Structure

- backend/
  - main.py — FastAPI app with CRUD routes and Motor connection
  - requirements.txt — Python dependencies
  - run.sh — Start script for Uvicorn dev server
  - .env.example — Backend environment variables template
- src/
  - lib/api.ts — Small API client for the frontend
  - app/page.tsx — Notes UI (list, add, edit, delete)
  - components/ui/* — shadcn/ui building blocks
- docker-compose.yml — Local MongoDB + Mongo Express

---

## How it Works

- The backend connects to MongoDB using Motor. Notes are stored in a `notes` collection. Pydantic models validate input/output.
- CORS is configured to allow requests from the Next.js dev server.
- The frontend uses fetch via a tiny API helper (`src/lib/api.ts`) to call FastAPI endpoints.
- The UI uses shadcn/ui components and shows loading skeletons and error messages.

---

## Common Troubleshooting

- Ensure MongoDB is running locally or that your `MONGODB_URI` points to a reachable instance.
- If using Docker, ensure the containers are up: `docker compose ps`.
- If CORS issues occur, verify `FRONTEND_ORIGIN` and restart the FastAPI server.
- If `run.sh` fails, run `bash backend/run.sh` or `python -m uvicorn backend.main:app --reload`.

---

## License

MIT

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.