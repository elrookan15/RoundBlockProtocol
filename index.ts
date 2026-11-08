import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

/**
 * RoundBlock Protocol Root Exports & Types
 */

export const LEAGUE_ESCROW_PROGRAM_ID = new PublicKey(
  "YG5dVJydevZcHJQtLNirYUseJtYQQoK83uPMznXVUbW",
);

export type NetworkEnvironment = "localnet" | "devnet" | "mainnet-beta";

export interface RoundBlockConfig {
  network: NetworkEnvironment | string;
  rpcUrl: string;
  programId: PublicKey;
}

export const DEFAULT_CONFIG: RoundBlockConfig = {
  network: "devnet",
  rpcUrl: "https://api.devnet.solana.com",
  programId: LEAGUE_ESCROW_PROGRAM_ID,
};

export interface WinnerSplitInput {
  winner: PublicKey;
  payout: BN | bigint | number;
}

export enum LeagueLifecycleStatus {
  Open = "Open",
  Locked = "Locked",
  Resolved = "Resolved",
  Cancelled = "Cancelled",
}

export interface PdaDerivationOptions {
  programId?: PublicKey;
  knownBump?: number;
}

/**
 * Derives a 64-bit little-endian Buffer from number, bigint, or BN.
 */
export function toLe64Buffer(val: number | bigint | BN): Buffer {
  if (BN.isBN(val)) {
    return val.toArrayLike(Buffer, "le", 8);
  }
  const bn = new BN(val.toString());
  return bn.toArrayLike(Buffer, "le", 8);
}

/**
 * Finds the Program Derived Address (PDA) for a League account.
 * If knownBump is supplied, uses createProgramAddressSync for O(1) derivation,
 * avoiding the iterative 255-bump scan in findProgramAddressSync.
 */
export function findLeaguePda(
  admin: PublicKey,
  leagueId: number | bigint | BN,
  programIdOrOptions:
    PublicKey | PdaDerivationOptions = LEAGUE_ESCROW_PROGRAM_ID,
): [PublicKey, number] {
  let programId = LEAGUE_ESCROW_PROGRAM_ID;
  let knownBump: number | undefined;

  if (programIdOrOptions instanceof PublicKey) {
    programId = programIdOrOptions;
  } else if (programIdOrOptions && typeof programIdOrOptions === "object") {
    programId = programIdOrOptions.programId ?? LEAGUE_ESCROW_PROGRAM_ID;
    knownBump = programIdOrOptions.knownBump;
  }

  const seeds = [
    Buffer.from("league"),
    admin.toBuffer(),
    toLe64Buffer(leagueId),
  ];

  if (typeof knownBump === "number") {
    const address = PublicKey.createProgramAddressSync(
      [...seeds, Buffer.from([knownBump])],
      programId,
    );
    return [address, knownBump];
  }

  return PublicKey.findProgramAddressSync(seeds, programId);
}

/**
 * Finds the Program Derived Address (PDA) for a Player Entry account.
 * Supports knownBump for O(1) address creation.
 */
export function findEntryPda(
  leaguePda: PublicKey,
  player: PublicKey,
  programIdOrOptions:
    PublicKey | PdaDerivationOptions = LEAGUE_ESCROW_PROGRAM_ID,
): [PublicKey, number] {
  let programId = LEAGUE_ESCROW_PROGRAM_ID;
  let knownBump: number | undefined;

  if (programIdOrOptions instanceof PublicKey) {
    programId = programIdOrOptions;
  } else if (programIdOrOptions && typeof programIdOrOptions === "object") {
    programId = programIdOrOptions.programId ?? LEAGUE_ESCROW_PROGRAM_ID;
    knownBump = programIdOrOptions.knownBump;
  }

  const seeds = [Buffer.from("entry"), leaguePda.toBuffer(), player.toBuffer()];

  if (typeof knownBump === "number") {
    const address = PublicKey.createProgramAddressSync(
      [...seeds, Buffer.from([knownBump])],
      programId,
    );
    return [address, knownBump];
  }

  return PublicKey.findProgramAddressSync(seeds, programId);
}

/**
 * Finds the Program Derived Address (PDA) for an SPL Vault token account.
 * Supports knownBump for O(1) address creation.
 */
export function findVaultPda(
  leaguePda: PublicKey,
  programIdOrOptions:
    PublicKey | PdaDerivationOptions = LEAGUE_ESCROW_PROGRAM_ID,
): [PublicKey, number] {
  let programId = LEAGUE_ESCROW_PROGRAM_ID;
  let knownBump: number | undefined;

  if (programIdOrOptions instanceof PublicKey) {
    programId = programIdOrOptions;
  } else if (programIdOrOptions && typeof programIdOrOptions === "object") {
    programId = programIdOrOptions.programId ?? LEAGUE_ESCROW_PROGRAM_ID;
    knownBump = programIdOrOptions.knownBump;
  }

  const seeds = [Buffer.from("vault"), leaguePda.toBuffer()];

  if (typeof knownBump === "number") {
    const address = PublicKey.createProgramAddressSync(
      [...seeds, Buffer.from([knownBump])],
      programId,
    );
    return [address, knownBump];
  }

  return PublicKey.findProgramAddressSync(seeds, programId);
}

/**
 * Batch derivation utility for player entries, reusing seed buffers to minimize allocations.
 */
export function findMultipleEntriesPda(
  leaguePda: PublicKey,
  players: PublicKey[],
  programId: PublicKey = LEAGUE_ESCROW_PROGRAM_ID,
): Array<{ player: PublicKey; pda: PublicKey; bump: number }> {
  const leagueBuffer = leaguePda.toBuffer();
  const entryPrefix = Buffer.from("entry");

  return players.map((player) => {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [entryPrefix, leagueBuffer, player.toBuffer()],
      programId,
    );
    return { player, pda, bump };
  });
}
