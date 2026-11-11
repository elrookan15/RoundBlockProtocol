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

const LEAGUE_SEED = Buffer.from("league");
const ENTRY_SEED = Buffer.from("entry");
const VAULT_SEED = Buffer.from("vault");

/**
 * Converts a 64-bit unsigned integer (number, bigint, or BN) to a little-endian Buffer.
 */
export function toLe64Buffer(val: number | bigint | BN): Buffer {
  if (BN.isBN(val)) {
    return val.toArrayLike(Buffer, "le", 8);
  }
  const buf = Buffer.alloc(8);
  if (typeof val === "bigint") {
    buf.writeBigUInt64LE(val, 0);
  } else {
    buf.writeBigUInt64LE(BigInt(val), 0);
  }
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
  return PublicKey.findProgramAddressSync(
    [LEAGUE_SEED, admin.toBuffer(), toLe64Buffer(leagueId)],
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
    [VAULT_SEED, leaguePda.toBuffer()],
    programId,
  );
}

/**
 * Batch finds the Program Derived Addresses (PDAs) for multiple Player Entry accounts.
 * Optimizes memory and allocation overhead by reusing the league PDA buffer across computations.
 */
export function findMultipleEntriesPda(
  leaguePda: PublicKey,
  players: PublicKey[],
  programId: PublicKey = LEAGUE_ESCROW_PROGRAM_ID,
): [PublicKey, number][] {
  const leagueBuffer = leaguePda.toBuffer();
  return players.map((player) =>
    PublicKey.findProgramAddressSync(
      [ENTRY_SEED, leagueBuffer, player.toBuffer()],
      programId,
    ),
  );
}
