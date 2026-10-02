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

const MAX_U64 = new BN("18446744073709551615");
const ZERO = new BN(0);

/**
 * Validates that leagueId fits within unsigned 64-bit integer bounds [0, 2^64 - 1].
 */
export function validateLeagueId(leagueId: number | bigint | BN): BN {
  let bn: BN;
  if (BN.isBN(leagueId)) {
    bn = leagueId;
  } else if (typeof leagueId === "bigint" || typeof leagueId === "number") {
    bn = new BN(leagueId.toString());
  } else {
    throw new TypeError("leagueId must be a number, bigint, or BN instance");
  }

  if (bn.lt(ZERO) || bn.gt(MAX_U64)) {
    throw new RangeError(
      "leagueId must be an unsigned 64-bit integer [0, 2^64 - 1]",
    );
  }

  return bn;
}

/**
 * Finds the Program Derived Address (PDA) for a League account.
 */
export function findLeaguePda(
  admin: PublicKey,
  leagueId: number | bigint | BN,
  programId: PublicKey = LEAGUE_ESCROW_PROGRAM_ID,
): [PublicKey, number] {
  if (!admin || !(admin instanceof PublicKey)) {
    throw new TypeError("admin must be a valid PublicKey instance");
  }
  if (!programId || !(programId instanceof PublicKey)) {
    throw new TypeError("programId must be a valid PublicKey instance");
  }

  const bn = validateLeagueId(leagueId);
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
  if (!leaguePda || !(leaguePda instanceof PublicKey)) {
    throw new TypeError("leaguePda must be a valid PublicKey instance");
  }
  if (!player || !(player instanceof PublicKey)) {
    throw new TypeError("player must be a valid PublicKey instance");
  }
  if (!programId || !(programId instanceof PublicKey)) {
    throw new TypeError("programId must be a valid PublicKey instance");
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
  if (!leaguePda || !(leaguePda instanceof PublicKey)) {
    throw new TypeError("leaguePda must be a valid PublicKey instance");
  }
  if (!programId || !(programId instanceof PublicKey)) {
    throw new TypeError("programId must be a valid PublicKey instance");
  }

  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), leaguePda.toBuffer()],
    programId,
  );
}
