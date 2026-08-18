# RoundBlock Protocol — League Escrow MVP

A crypto-native fantasy football platform on **Solana**. This repository is the
**escrow-first MVP**: the trust-minimized money layer that holds league entry
fees and pays out winners. It is deliberately small — the broader vision
(dynamic NFTs, DAO governance, AMM salary caps, an AI draft advisor, a full draft
room) is **not** built here and is tracked in [`NEXT_STEPS.md`](./NEXT_STEPS.md).

What ships today:

- An **Anchor (Rust)** program, `league-escrow`, that escrows league entry fees
  and distributes payouts in **either native SOL or an SPL token (USDC)**, with
  PDA-based accounts, access control, and checked arithmetic.
- A **TypeScript integration test suite** (Anchor + Mocha) covering the full
  happy path and failure cases for both the SOL and USDC paths.
- A minimal **Next.js** frontend using `@solana/wallet-adapter` and
  `@coral-xyz/anchor` to connect a wallet, create a league (SOL or USDC), browse
  open leagues, join/deposit, and view escrow status.
- **GitHub Actions CI** that builds the program and runs its tests.

## Monorepo layout

```
.
├── programs/league-escrow/   # Anchor program (Rust)
│   └── src/lib.rs
├── tests/                     # Anchor TypeScript integration tests
│   └── league-escrow.ts
├── app/                       # Next.js frontend (wallet-adapter + anchor client)
│   └── src/{pages,components,lib}
├── Anchor.toml                # Anchor workspace config
├── Cargo.toml                 # Rust workspace
├── .github/workflows/ci.yml   # CI: anchor build + anchor test
├── NEXT_STEPS.md              # Deferred / future-phase features
└── .env.example
```

## The escrow program

Program id: `YG5dVJydevZcHJQtLNirYUseJtYQQoK83uPMznXVUbW`

> **Program keypair / rotation.** The committed keypair at
> `target/deploy/league_escrow-keypair.json` is a fresh, random key intended for
> **devnet/localnet only**. It is fine to commit for reproducible dev + CI, but
> because it controls program upgrades you should **rotate it before any real /
> mainnet deployment** (generate a new one with `solana-keygen new`, run
> `anchor keys sync`, and manage it as a secret).

### Accounts

- **`League`** — PDA seeded by `["league", admin, league_id]`. Holds config
  (admin, oracle, entry fee, max players), lifecycle `status`
  (`Open → Locked → Resolved`), the running `total_pot`, the currency
  (`payment_mint`: `None` = SOL, `Some(mint)` = SPL) and vault, and — after
  resolve — the winner payout table.
- **`PlayerEntry`** — PDA seeded by `["entry", league, player]`, created when a
  player joins. Because it is `init`-ed, a wallet can only join a league once.

### Instructions

The program supports **two currencies** chosen at league creation: native SOL
and any SPL token (e.g. USDC). Fund movement is currency-specific; the lifecycle
(`lock`/`resolve`) is shared.

| Instruction         | Who             | Effect |
| ------------------- | --------------- | ------ |
| `create_league`     | anyone (admin)  | Initializes a **SOL** league with entry fee, max players, and an oracle authority. |
| `create_league_spl` | anyone (admin)  | Same, for an **SPL-token** league; also creates the vault ATA owned by the league PDA. |
| `join_league`       | any player      | Deposits the SOL entry fee into the league PDA and registers a `PlayerEntry`. |
| `join_league_spl`   | any player      | Transfers the SPL entry fee from the player's ATA into the vault and registers a `PlayerEntry`. |
| `lock_league`       | admin only      | Closes entries (`Open → Locked`). Currency-agnostic. |
| `resolve_league`    | admin or oracle | Records winner(s) and their split (`Locked → Resolved`). Validated: sum ≤ pot, no duplicates, count ≤ players. Currency-agnostic. |
| `claim_payout`      | winning player  | Withdraws the caller's SOL share from the league PDA exactly once. |
| `claim_payout_spl`  | winning player  | Transfers the caller's SPL share from the vault (signed by the league PDA) to their ATA, exactly once. |
| `cancel_league`     | admin only      | Cancels an under-subscribed/abandoned league (`Open → Cancelled`). Only allowed before locking. |
| `refund`            | any player      | Reclaims the caller's SOL deposit from a `Cancelled` league; closes their `PlayerEntry` PDA (rent returned) so it can't be refunded twice. |
| `refund_spl`        | any player      | Reclaims the caller's SPL deposit from a `Cancelled` league; closes their `PlayerEntry` PDA (rent returned) so it can't be refunded twice. |

Access control uses `has_one`/explicit checks; the SOL/SPL paths each guard on
`payment_mint` (a mismatched-currency call fails with `WrongCurrency`); all
balance math uses `checked_add`/`checked_sub`; the SOL escrow keeps its
rent-exempt reserve intact on withdrawal.

### Currency: SOL vs USDC

- **SOL path** (`create_league` / `join_league` / `claim_payout`) — the simplest
  option: the `League` PDA custodies lamports directly on top of its rent-exempt
  reserve, with no token plumbing. Tradeoff: leagues are denominated in a
  volatile asset.
- **SPL / USDC path** (`create_league_spl` / `join_league_spl` /
  `claim_payout_spl`) — funds live in an **associated token account (the vault)**
  owned by the league PDA; deposits and payouts are `token::transfer` CPIs and
  use ATAs. Pass the mint (e.g. devnet/mainnet USDC) at creation.

Both paths share the same accounts, lifecycle, and access control, so choosing a
currency is per-league, not a protocol-wide decision.

## Prerequisites

- **Rust** (stable, ≥ 1.85 — some transitive deps require the 2024 edition)
- **Solana CLI (Agave)** — `sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"`
- **Anchor CLI 0.31.1** — `cargo install --git https://github.com/coral-xyz/anchor --tag v0.31.1 anchor-cli --locked`
- **Node.js ≥ 20** and **Yarn** (classic)

## Build & test (localnet)

```bash
# from the repo root
yarn install            # test-suite dependencies
anchor build            # compile the SBF program + generate IDL/types
anchor test             # spins up a local validator, deploys, runs the tests
```

`anchor test` should report **14 passing**: the full SOL lifecycle
(create → join × 2 → lock → resolve → claim) plus SOL failure cases (join after
lock, non-admin lock/resolve, resolve before lock, payout > pot, double-claim,
non-winner claim, duplicate join), **and** the USDC/SPL path (happy path, plus
non-admin/oracle resolve, double-claim, and a wrong-currency guard).

## Deploy to devnet

```bash
solana config set --url devnet
solana airdrop 2                      # fund your deploy wallet
anchor build
anchor deploy --provider.cluster devnet
```

If you generate a fresh program keypair, run `anchor keys sync` to update the
`declare_id!` and `Anchor.toml`, then rebuild.

## Run the frontend

```bash
cd app
cp .env.local.example .env.local      # point NEXT_PUBLIC_SOLANA_RPC_URL at devnet or localnet
npm install
npm run dev                           # http://localhost:3000
```

The IDL and generated types are committed under `app/src/lib/idl/`. After
changing the program, regenerate them:

```bash
anchor build
cp target/idl/league_escrow.json app/src/lib/idl/league_escrow.json
cp target/types/league_escrow.ts app/src/lib/idl/league_escrow.ts
```

Then in the browser: connect Phantom → **Create a league** (pick **SOL** or
**USDC**) → **Browse open leagues** (or open by admin + id) → **Join / deposit**
→ admin **Lock** and **Resolve** → winners **Claim payout**. The USDC path uses
the mint from `NEXT_PUBLIC_USDC_MINT` (defaults to Circle's devnet USDC); on
devnet you can mint test USDC to your wallet via
[faucet.circle.com](https://faucet.circle.com).

## License

[MIT](./LICENSE)
