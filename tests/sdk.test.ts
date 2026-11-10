import { PublicKey, Keypair } from "@solana/web3.js";
import BN from "bn.js";
import { expect } from "chai";
import {
  findLeaguePda,
  findEntryPda,
  findVaultPda,
  findMultipleEntriesPda,
  toLe64Buffer,
  LEAGUE_ESCROW_PROGRAM_ID,
} from "../index";

describe("RoundBlock SDK Unit Tests", () => {
  const admin = Keypair.generate().publicKey;
  const player1 = Keypair.generate().publicKey;
  const player2 = Keypair.generate().publicKey;
  const leagueId = new BN(12345);

  describe("toLe64Buffer", () => {
    it("converts number, bigint, and BN consistently", () => {
      const b1 = toLe64Buffer(12345);
      const b2 = toLe64Buffer(BigInt(12345));
      const b3 = toLe64Buffer(new BN(12345));

      expect(b1.equals(b2)).to.be.true;
      expect(b1.equals(b3)).to.be.true;
      expect(b1.length).to.equal(8);
      expect(b1.readBigUInt64LE(0)).to.equal(BigInt(12345));
    });
  });

  describe("PDA Derivations with knownBump fast-path", () => {
    it("derives League PDA and matches knownBump fast path", () => {
      const [canonicalPda, bump] = findLeaguePda(admin, leagueId);
      expect(canonicalPda).to.be.instanceOf(PublicKey);
      expect(typeof bump).to.equal("number");

      // Verify fast path with options
      const [fastPda, fastBump] = findLeaguePda(admin, leagueId, {
        knownBump: bump,
      });
      expect(fastPda.toBase58()).to.equal(canonicalPda.toBase58());
      expect(fastBump).to.equal(bump);
    });

    it("derives Entry PDA and matches knownBump fast path", () => {
      const [leaguePda] = findLeaguePda(admin, leagueId);
      const [canonicalPda, bump] = findEntryPda(leaguePda, player1);
      expect(canonicalPda).to.be.instanceOf(PublicKey);

      const [fastPda, fastBump] = findEntryPda(leaguePda, player1, {
        knownBump: bump,
      });
      expect(fastPda.toBase58()).to.equal(canonicalPda.toBase58());
      expect(fastBump).to.equal(bump);
    });

    it("derives Vault PDA and matches knownBump fast path", () => {
      const [leaguePda] = findLeaguePda(admin, leagueId);
      const [canonicalPda, bump] = findVaultPda(leaguePda);
      expect(canonicalPda).to.be.instanceOf(PublicKey);

      const [fastPda, fastBump] = findVaultPda(leaguePda, { knownBump: bump });
      expect(fastPda.toBase58()).to.equal(canonicalPda.toBase58());
      expect(fastBump).to.equal(bump);
    });
  });

  describe("findMultipleEntriesPda batch derivation", () => {
    it("derives multiple entry PDAs in batch accurately", () => {
      const [leaguePda] = findLeaguePda(admin, leagueId);
      const players = [player1, player2];

      const batchResults = findMultipleEntriesPda(leaguePda, players);
      expect(batchResults.length).to.equal(2);

      const [p1Expected, p1Bump] = findEntryPda(leaguePda, player1);
      const [p2Expected, p2Bump] = findEntryPda(leaguePda, player2);

      expect(batchResults[0].pda.toBase58()).to.equal(p1Expected.toBase58());
      expect(batchResults[0].bump).to.equal(p1Bump);

      expect(batchResults[1].pda.toBase58()).to.equal(p2Expected.toBase58());
      expect(batchResults[1].bump).to.equal(p2Bump);
    });
  });
});
