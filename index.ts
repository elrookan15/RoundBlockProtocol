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
 * Efficiently finds Program Derived Addresses (PDAs) for a batch of player entries.
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
    [Buffer.from("vault"), leaguePda.toBuffer()],
    programId,
  );
}

export interface WinnerSplitInput {
  winner: PublicKey;
  payout: BN;
}

/**
 * Validates winner splits client-side prior to transaction construction.
 * Ensures no duplicate winners and total payout <= total pot.
 */
export function validateWinnerSplits(
  winnerInputs: WinnerSplitInput[],
  totalPot: BN,
  maxPlayers: number,
): { valid: boolean; reason?: string } {
  if (winnerInputs.length === 0) {
    return { valid: false, reason: "Winner inputs cannot be empty" };
  }
  if (winnerInputs.length > maxPlayers) {
    return {
      valid: false,
      reason: `Winner count (${winnerInputs.length}) exceeds max players (${maxPlayers})`,
    };
  }

  const seen = new Set<string>();
  let totalPayout = new BN(0);

  for (const input of winnerInputs) {
    const key = input.winner.toBase58();
    if (seen.has(key)) {
      return { valid: false, reason: `Duplicate winner detected: ${key}` };
    }
    seen.add(key);
    totalPayout = totalPayout.add(input.payout);
  }

  if (totalPayout.gt(totalPot)) {
    return {
      valid: false,
      reason: `Total payout (${totalPayout.toString()}) exceeds total pot (${totalPot.toString()})`,
    };
  }

  return { valid: true };
}
