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
 * Batch derives Player Entry PDAs for a list of winner public keys.
 */
export function findWinnerEntryPdas(
  leaguePda: PublicKey,
  winners: PublicKey[],
  programId: PublicKey = LEAGUE_ESCROW_PROGRAM_ID,
): Array<[PublicKey, number]> {
  return winners.map((winner) => findEntryPda(leaguePda, winner, programId));
}

/**
 * Constructs AccountMeta objects for remaining_accounts passed to resolve_league.
 */
export function findWinnerRemainingAccountMetas(
  leaguePda: PublicKey,
  winners: PublicKey[],
  programId: PublicKey = LEAGUE_ESCROW_PROGRAM_ID,
): Array<{ pubkey: PublicKey; isWritable: boolean; isSigner: boolean }> {
  return winners.map((winner) => {
    const [entryPda] = findEntryPda(leaguePda, winner, programId);
    return {
      pubkey: entryPda,
      isWritable: false,
      isSigner: false,
    };
  });
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
