# Midnight Anonymous Survey

Next.js dapp at repo root, Compact contract in `contract/`.

## What it does

- Connects Midnight Lace wallet in browser
- Connects 1AM or Lace wallet in browser
- Reads live anonymous survey state from Midnight indexer
- Submits private responses through Midnight transaction flow
- Shows live public summaries with auto-refresh

## Scripts

```bash
npm install
npm run typecheck
npm run contract:build
npm run dev
```

## Setup

1. Install 1AM or Lace browser extension.
2. Select Midnight preprod in wallet.
3. Run `npm run contract:build`.
4. Run `npm run dev`.
5. Open `/deploy`, connect wallet, click `Deploy contract`.
6. The preprod contract address is already set to `bd6d4c84cd0e28ad996f2a84c7b21a94dd972a6a31b9817b981769c0ae4e9135` in `.env.local` and `.env.example`.
7. If you use Lace, start a local proof server at `http://localhost:6300` or set `NEXT_PUBLIC_MIDNIGHT_PROOF_SERVER_URL`.

## Notes

- `contract/build` compiles Compact to `contract/src/managed/poll`
- Deploy uses browser wallet proving/provider flow and 1AM-sponsored DUST.
- No funded server-side deployer wallet or local proof server required.
- Deployed contract address appears on `/deploy` immediately after submission.
- If you redeploy to a new contract address, update `NEXT_PUBLIC_CONTRACT_ADDRESS` and restart the app.
- `NEXT_PUBLIC_MIDNIGHT_NETWORK`, `NEXT_PUBLIC_CONTRACT_ADDRESS`, and `NEXT_PUBLIC_MIDNIGHT_PROOF_SERVER_URL` are the runtime env vars the app actually reads.
- Voting also runs through the connected browser wallet on the survey page; there is no server-side vote submitter.
- Frontend refreshes `/api/poll` every 5 seconds
