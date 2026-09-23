import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

/**
 * RoundBlock Protocol Root Exports, Constants & Utilities
 */

export const LEAGUE_ESCROW_PROGRAM_ID = new PublicKey(
  "YG5dVJydevZcHJQtLNirYUseJtYQQoK83uPMznXVUbW",
);

export const SEED_LEAGUE = Buffer.from("league");
export const SEED_ENTRY = Buffer.from("entry");
export const SEED_VAULT = Buffer.from("vault");

export type LeagueStatusType = "Open" | "Locked" | "Resolved" | "Cancelled";

export interface WinnerInputType {
  winner: PublicKey;
  payout: BN | number;
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
 * Converts any numeric representation of leagueId to an 8-byte little-endian Buffer.
 */
export function toLeagueIdBuffer(leagueId: number | bigint | BN): Buffer {
  const bn = BN.isBN(leagueId) ? leagueId : new BN(leagueId.toString());
  return bn.toArrayLike(Buffer, "le", 8);
}

/**
 * Finds the Program Derived Address (PDA) for a League account.
 */
export function findLeaguePda(
  admin: PublicKey,
  leagueId: number | bigint | BN,
  programId: PublicKey = LEAGUE_ESCROW_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEED_LEAGUE, admin.toBuffer(), toLeagueIdBuffer(leagueId)],
    programId,
  );
}

/**
 * Batch derives Program Derived Addresses (PDAs) for multiple League accounts.
 */
export function findLeaguePdaBatch(
  admin: PublicKey,
  leagueIds: Array<number | bigint | BN>,
  programId: PublicKey = LEAGUE_ESCROW_PROGRAM_ID,
): Array<[PublicKey, number]> {
  return leagueIds.map((id) => findLeaguePda(admin, id, programId));
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
    [SEED_ENTRY, leaguePda.toBuffer(), player.toBuffer()],
    programId,
  );
}

/**
 * Batch derives Program Derived Addresses (PDAs) for multiple Player Entry accounts.
 */
export function findEntryPdaBatch(
  leaguePda: PublicKey,
  players: PublicKey[],
  programId: PublicKey = LEAGUE_ESCROW_PROGRAM_ID,
): Array<[PublicKey, number]> {
  return players.map((player) => findEntryPda(leaguePda, player, programId));
}

/**
 * Finds the Program Derived Address (PDA) for an SPL Vault token account.
 */
export function findVaultPda(
  leaguePda: PublicKey,
  programId: PublicKey = LEAGUE_ESCROW_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEED_VAULT, leaguePda.toBuffer()],
    programId,
  );
}
