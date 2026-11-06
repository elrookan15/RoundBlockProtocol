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

/**
 * Finds the Program Derived Address (PDA) for a League account.
 */
export function findLeaguePda(
  admin: PublicKey,
  leagueId: number | bigint | BN,
  programId: PublicKey = LEAGUE_ESCROW_PROGRAM_ID,
): [PublicKey, number] {
  if (!admin || !PublicKey.isOnCurve(admin.toBytes())) {
    throw new Error("Invalid admin public key");
  }
  const bn = BN.isBN(leagueId) ? leagueId : new BN(leagueId.toString());
  if (bn.isNeg() || bn.bitLength() > 64) {
    throw new Error("leagueId must be an unsigned 64-bit integer");
  }
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
  if (!leaguePda || !player) {
    throw new Error("leaguePda and player public keys are required");
  }
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
  if (!leaguePda) {
    throw new Error("leaguePda public key is required");
  }
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), leaguePda.toBuffer()],
    programId,
  );
}
