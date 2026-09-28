import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

/**
 * RoundBlock Protocol Root Exports & Types
 */

export const LEAGUE_ESCROW_PROGRAM_ID = new PublicKey(
  "YG5dVJydevZcHJQtLNirYUseJtYQQoK83uPMznXVUbW",
);

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

// Static seed buffers to prevent repetitive allocations
const SEED_LEAGUE = Buffer.from("league");
const SEED_ENTRY = Buffer.from("entry");
const SEED_VAULT = Buffer.from("vault");

/**
 * Converts a input league ID into a 8-byte little-endian Buffer.
 */
export function leagueIdToBuffer(
  leagueId: number | bigint | BN | string,
): Buffer {
  const bn = BN.isBN(leagueId) ? leagueId : new BN(leagueId.toString());
  if (bn.isNeg()) {
    throw new Error("League ID must be a non-negative integer");
  }
  return bn.toArrayLike(Buffer, "le", 8);
}

/**
 * Finds the Program Derived Address (PDA) for a League account.
 */
export function findLeaguePda(
  admin: PublicKey,
  leagueId: number | bigint | BN | string,
  programId: PublicKey = LEAGUE_ESCROW_PROGRAM_ID,
): [PublicKey, number] {
  const leagueIdBuffer = leagueIdToBuffer(leagueId);
  return PublicKey.findProgramAddressSync(
    [SEED_LEAGUE, admin.toBuffer(), leagueIdBuffer],
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
    [SEED_ENTRY, leaguePda.toBuffer(), player.toBuffer()],
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
    [SEED_VAULT, leaguePda.toBuffer()],
    programId,
  );
}
