
# DealDine (Downloadable Prototype)

A working Node/Express + vanilla JS app that matches the DealDine UI and exposes APIs for deals, chains, preferences, and email-ingested deals. Includes a Gmail IMAP fetcher + parser stub.

## Quick Start
```bash
cd dealdinework
npm install
cp .env.sample .env   # add your Gmail app password
npm run dev           # or: npm start
# open http://localhost:3000
```

## Email (optional)
- Create a Gmail **App Password**, put `EMAIL_USER` and `EMAIL_PASS` in `.env`.
- Run: `npm run fetch:gmail` (parses last 5 recent emails; does NOT store automatically).

## Endpoints
- `GET /api/chains`
- `GET /api/deals?sort=relevance|savings|expiration&chains=comma,separated,ids`
- `POST /api/preferences { userId, selectedChainIds }`
- `GET /api/preferences/:userId`
- `GET /api/personalized/:userId`
- `POST /api/process-email` (ingests parsed deals into feed)
