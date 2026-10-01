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

// Static seed constants to avoid allocation churn on derivation hotpaths
const LEAGUE_SEED = Buffer.from("league");
const ENTRY_SEED = Buffer.from("entry");
const VAULT_SEED = Buffer.from("vault");

const U64_MAX = BigInt("18446744073709551615");

/**
 * Converts a league ID (number, bigint, or BN) into a 8-byte little-endian Buffer with strict bounds checking.
 */
export function leagueIdToBuffer(leagueId: number | bigint | BN): Buffer {
  let val: bigint;
  if (typeof leagueId === "bigint") {
    val = leagueId;
  } else if (typeof leagueId === "number") {
    if (!Number.isInteger(leagueId)) {
      throw new TypeError(
        `League ID number must be an integer, got ${leagueId}`,
      );
    }
    val = BigInt(leagueId);
  } else if (BN.isBN(leagueId)) {
    if (leagueId.isNeg()) {
      throw new RangeError("League ID cannot be negative");
    }
    const bnBuf = leagueId.toArrayLike(Buffer, "le", 8);
    if (leagueId.bitLength() > 64) {
      throw new RangeError("League ID exceeds u64 maximum bounds");
    }
    return bnBuf;
  } else {
    throw new TypeError("Invalid league ID type");
  }

  if (val < 0n) {
    throw new RangeError("League ID cannot be negative");
  }
  if (val > U64_MAX) {
    throw new RangeError("League ID exceeds u64 maximum bounds");
  }

  const buf = Buffer.allocUnsafe(8);
  buf.writeBigUInt64LE(val, 0);
  return buf;
}

/**
 * Finds the Program Derived Address (PDA) for a League account.
 */
export function findLeaguePda(
  admin: PublicKey,
  leagueId: number | bigint | BN,
  programId: PublicKey = LEAGUE_ESCROW_PROGRAM_ID,
): [PublicKey, number] {
  const idBuffer = leagueIdToBuffer(leagueId);
  return PublicKey.findProgramAddressSync(
    [LEAGUE_SEED, admin.toBuffer(), idBuffer],
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
    [ENTRY_SEED, leaguePda.toBuffer(), player.toBuffer()],
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
    [VAULT_SEED, leaguePda.toBuffer()],
    programId,
  );
}
