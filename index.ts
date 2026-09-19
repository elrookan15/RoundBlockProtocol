import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

/**
 * RoundBlock Protocol Root Exports & Types
 */

export const LEAGUE_ESCROW_PROGRAM_ID = new PublicKey(
  "YG5dVJydevZcHJQtLNirYUseJtYQQoK83uPMznXVUbW",
);

export enum LeagueStatus {
  Open = "Open",
  Locked = "Locked",
  Resolved = "Resolved",
  Cancelled = "Cancelled",
}

export interface WinnerSplit {
  winner: PublicKey;
  payout: BN;
  claimed: boolean;
}

export interface WinnerInput {
  winner: PublicKey;
  payout: BN;
}

export interface RoundBlockConfig {
  network: string;
  rpcUrl: string;
  programId: PublicKey;
}

export const DEFAULT_CONFIG: RoundBlockConfig = {
  network: "devnet",
  rpcUrl: "https://api.devnet.solana.com",
  programId: LEAGUE_ESCROW_PROGRAM_ID,
};

/**
 * Protocol Event Interfaces
 */
export interface LeagueCreatedEvent {
  league: PublicKey;
  admin: PublicKey;
  oracle: PublicKey;
  leagueId: BN;
  entryFee: BN;
  maxPlayers: number;
  paymentMint: PublicKey | null;
}

export interface PlayerJoinedEvent {
  league: PublicKey;
  player: PublicKey;
  entry: PublicKey;
  entryFee: BN;
  paymentMint: PublicKey | null;
}

export interface LeagueLockedEvent {
  league: PublicKey;
  admin: PublicKey;
}

export interface LeagueResolvedEvent {
  league: PublicKey;
  authority: PublicKey;
  winnersCount: number;
  totalPayout: BN;
}

export interface PayoutClaimedEvent {
  league: PublicKey;
  winner: PublicKey;
  payout: BN;
  paymentMint: PublicKey | null;
}

export interface LeagueCancelledEvent {
  league: PublicKey;
  admin: PublicKey;
}

export interface PlayerRefundedEvent {
  league: PublicKey;
  player: PublicKey;
  entryFee: BN;
  paymentMint: PublicKey | null;
}

export interface LeagueClosedEvent {
  league: PublicKey;
  admin: PublicKey;
}

/**
 * Finds the Program Derived Address (PDA) for a League account.
 */
export function findLeaguePda(
  admin: PublicKey,
  leagueId: number | bigint | BN,
  programId: PublicKey = LEAGUE_ESCROW_PROGRAM_ID,
): [PublicKey, number] {
  const bn = BN.isBN(leagueId) ? leagueId : new BN(leagueId.toString());
  return PublicKey.findProgramAddressSync(
    [Buffer.from("league"), admin.toBuffer(), bn.toArrayLike(Buffer, "le", 8)],
    programId,
  );
}

/**
 * Finds the Program Derived Address (PDA) for a Player Entry account.
 */
export function findEntryPda(
  leaguePda: PublicKey,
  player: PublicKey,
  programId: PublicKey = LEAGUE_ESCROW_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("entry"), leaguePda.toBuffer(), player.toBuffer()],
    programId,
  );
}

/**
 * Finds the Program Derived Address (PDA) for an SPL Vault token account.
 */
export function findVaultPda(
  leaguePda: PublicKey,
  programId: PublicKey = LEAGUE_ESCROW_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), leaguePda.toBuffer()],
    programId,
  );
}
