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

/**
 * Calculates the allocated space in bytes for a League account given max_players.
 * Matches Rust's `League::space(max_players)`.
 */
export function calculateLeagueSpace(maxPlayers: number): number {
  if (
    typeof maxPlayers !== "number" ||
    !Number.isInteger(maxPlayers) ||
    maxPlayers < 1 ||
    maxPlayers > 255
  ) {
    throw new Error(
      "Invalid maxPlayers: must be an integer between 1 and 255.",
    );
  }
  return (
    8 + // discriminator
    32 + // admin
    32 + // oracle
    8 + // league_id
    8 + // entry_fee
    1 + // max_players
    1 + // player_count
    1 + // status
    8 + // total_pot
    33 + // payment_mint: Option<Pubkey>
    (4 + maxPlayers * (32 + 8 + 1)) + // winners
    1 + // bump
    1 // vault_bump
  );
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
  if (bn.isNeg()) {
    throw new Error("Invalid leagueId: must be a non-negative number.");
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
