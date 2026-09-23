# Federov Mistake Ledger

Portable, versioned ledger tracking failure patterns, bad assumptions, corrective rules, and regression tests across development sessions.

## M-001

date: 2026-08-27
trigger_pattern: Supabase RLS policy using `auth.uid()` in a subquery on a join table
bad_assumption: Assumed `auth.uid()` short-circuits before the join executes
what_actually_happened: Policy evaluated per-row after the join, causing an N+1 performance regression flagged only in prod query logs, not in local testing
corrective_rule: Always ask "does this policy need to run inside the join or before it?" and check the query plan (EXPLAIN ANALYZE) before shipping any RLS policy touching more than one table
regression_test: Add EXPLAIN ANALYZE assertion to CI for any migration touching RLS policies with joins
confidence_adjustment: Lower default confidence on "this RLS policy is correct" claims from High to Medium until a query plan is shown
source: seed example — replace with your first real catch

## M-002

date: 2026-08-27
trigger_pattern: useMemo/useCallback added "for performance" without profiling
bad_assumption: Assumed memoization is free and always net-positive
what_actually_happened: Added complexity and a stale-closure bug with no measured benefit — the component was not on a re-render-critical path
corrective_rule: Never add useMemo/useCallback without stating the measured re-render cost it removes; if it can't be measured, don't add it
regression_test: N/A (code review discipline, not a unit test)
confidence_adjustment: Treat all unmeasured performance claims as Low confidence
source: seed example — replace with your first real catch

## M-003

date: 2026-08-27
trigger_pattern: CI script execution with wildcard file globs or missing directories
bad_assumption: Assumed prettier check pattern `"tests/**/*.ts"` passes when no matching files exist in root workspace
what_actually_happened: Prettier exited with error code 2 when matching zero files during package linting execution
corrective_rule: Configure fallback file targets or `--no-error-on-unmatched-pattern` flags when globs in root tooling scripts target optional workspace subdirectories
regression_test: `yarn lint` execution in CI workflow
confidence_adjustment: Verify all npm/yarn script globs against actual workspace topology before committing CI configuration
source: session audit

## M-004

date: 2026-09-10
trigger_pattern: Hardcoded account size `League::LEN` in Anchor program using fixed array size instead of `max_players` function parameter
bad_assumption: Assumed max 10 players capacity in `League::LEN` space calculation without tying space to `max_players`
what_actually_happened: Creating a league with `max_players > 10` succeeded at initialization but failed during `resolve_league` with `AccountDataTooSmall` when serializing >10 winner splits
corrective_rule: Calculate account space dynamically based on input parameters using `League::space(max_players)` during `init`
regression_test: `tests/league-escrow.ts` test case for `max_players = 12`
confidence_adjustment: Flag fixed-size `space` calculations on dynamic structs in Anchor as Medium risk until verified against parameter bounds
source: audit sweep

## M-005

date: 2026-09-12
trigger_pattern: Escrow refund path closing player PDA without updating parent `League` state fields (`player_count`, `total_pot`) or supporting rent reclamation on termination
bad_assumption: Assumed closing the `PlayerEntry` PDA alone was sufficient for refunds without updating `player_count` and `total_pot` on `League`
what_actually_happened: `League` account maintained stale `player_count` and `total_pot` metrics after refunds, breaking downstream lifecycle state assertions and blocking clean protocol rent reclamation on league close
corrective_rule: Always pair PDA account closures with checked decrements on parent state fields (`player_count.checked_sub`, `total_pot.checked_sub`) and provide explicit account close handlers (`close_league`) to reclaim rent lamports for terminal states
regression_test: `tests/league-escrow.ts` test case for "Cancel and Refund Path with State Integrity Checks"
confidence_adjustment: Lower default confidence on partial state teardown routines until state invariants are verified post-execution
source: audit sweep

## M-006

date: 2026-09-15
trigger_pattern: Payout claim instructions (`claim_payout`, `claim_payout_spl`) updating winner `claimed` boolean without decrementing `league.total_pot`
bad_assumption: Assumed updating `winner.claimed = true` was sufficient state tracking without adjusting parent state `total_pot`
what_actually_happened: `league.total_pot` remained static after payouts were claimed, creating a drift between tracked total pot and actual on-chain account/vault token balances
corrective_rule: Always pair payout transfers with explicit checked decrements on `league.total_pot` (`league.total_pot.checked_sub(payout)`) to maintain state accounting invariants
regression_test: `tests/league-escrow.ts` assertion verifying `account.totalPot` decrements post-claim
confidence_adjustment: Flag state structs tracking balance aggregators as requiring exact sync assertions across all withdrawal/claim paths
source: audit sweep

## M-007

date: 2026-09-15
trigger_pattern: Searching remaining accounts in loop using `iter().find()` with O(N * M) complexity during instruction processing
bad_assumption: Assumed linear `find()` over `ctx.remaining_accounts` had negligible CU impact on Solana runtime
what_actually_happened: Nested iteration over N winners and M remaining accounts burned excessive compute units and scaled quadratically
corrective_rule: Enforce positional account indexing (`ctx.remaining_accounts[i]`) with explicit length checks (`ctx.remaining_accounts.len() == winner_inputs.len()`) for O(N) verification complexity
regression_test: `cargo check --manifest-path programs/league-escrow/Cargo.toml` and unit tests
confidence_adjustment: Require positional indexing for slice lookups in Anchor instruction handlers
source: performance audit
