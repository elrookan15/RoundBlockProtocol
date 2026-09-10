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
