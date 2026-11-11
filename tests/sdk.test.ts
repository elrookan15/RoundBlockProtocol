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
  DEFAULT_CONFIG,
} from "../index";

describe("RoundBlock TypeScript SDK Unit Tests", () => {
  const dummyProgramId = LEAGUE_ESCROW_PROGRAM_ID;
  const admin = Keypair.generate().publicKey;
  const player1 = Keypair.generate().publicKey;
  const player2 = Keypair.generate().publicKey;
  const player3 = Keypair.generate().publicKey;

  describe("toLe64Buffer helper", () => {
    it("converts number correctly to 8-byte little-endian Buffer", () => {
      const buf = toLe64Buffer(100);
      expect(buf.length).to.equal(8);
      expect(buf.readBigUInt64LE(0)).to.equal(100n);
    });

    it("converts bigint correctly to 8-byte little-endian Buffer", () => {
      const val = 18446744073709551615n; // u64 max
      const buf = toLe64Buffer(val);
      expect(buf.length).to.equal(8);
      expect(buf.readBigUInt64LE(0)).to.equal(val);
    });

    it("converts BN correctly to 8-byte little-endian Buffer", () => {
      const bn = new BN("1234567890123");
      const buf = toLe64Buffer(bn);
      expect(buf.length).to.equal(8);
      expect(buf.readBigUInt64LE(0)).to.equal(1234567890123n);
    });
  });

  describe("PDA Derivations", () => {
    it("derives deterministic findLeaguePda across number, bigint, and BN", () => {
      const [pdaNum, bumpNum] = findLeaguePda(admin, 101, dummyProgramId);
      const [pdaBigInt, bumpBigInt] = findLeaguePda(
        admin,
        101n,
        dummyProgramId,
      );
      const [pdaBN, bumpBN] = findLeaguePda(admin, new BN(101), dummyProgramId);

      expect(pdaNum.toBase58()).to.equal(pdaBigInt.toBase58());
      expect(pdaNum.toBase58()).to.equal(pdaBN.toBase58());
      expect(bumpNum).to.equal(bumpBigInt);
      expect(bumpNum).to.equal(bumpBN);
    });

    it("derives findVaultPda matching expected seed structure", () => {
      const [leaguePda] = findLeaguePda(admin, 101, dummyProgramId);
      const [vaultPda, bump] = findVaultPda(leaguePda, dummyProgramId);

      const [expectedPda, expectedBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), leaguePda.toBuffer()],
        dummyProgramId,
      );

      expect(vaultPda.toBase58()).to.equal(expectedPda.toBase58());
      expect(bump).to.equal(expectedBump);
    });

    it("derives single findEntryPda correctly", () => {
      const [leaguePda] = findLeaguePda(admin, 101, dummyProgramId);
      const [entryPda, bump] = findEntryPda(leaguePda, player1, dummyProgramId);

      const [expectedPda, expectedBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("entry"), leaguePda.toBuffer(), player1.toBuffer()],
        dummyProgramId,
      );

      expect(entryPda.toBase58()).to.equal(expectedPda.toBase58());
      expect(bump).to.equal(expectedBump);
    });

    it("batch derives findMultipleEntriesPda matching findEntryPda", () => {
      const [leaguePda] = findLeaguePda(admin, 101, dummyProgramId);
      const players = [player1, player2, player3];

      const batchResults = findMultipleEntriesPda(
        leaguePda,
        players,
        dummyProgramId,
      );
      expect(batchResults.length).to.equal(3);

      for (let i = 0; i < players.length; i++) {
        const [singlePda, singleBump] = findEntryPda(
          leaguePda,
          players[i],
          dummyProgramId,
        );
        expect(batchResults[i][0].toBase58()).to.equal(singlePda.toBase58());
        expect(batchResults[i][1]).to.equal(singleBump);
      }
    });

    it("handles empty array in findMultipleEntriesPda cleanly", () => {
      const [leaguePda] = findLeaguePda(admin, 101, dummyProgramId);
      const batchResults = findMultipleEntriesPda(
        leaguePda,
        [],
        dummyProgramId,
      );
      expect(batchResults).to.deep.equal([]);
    });

    it("exposes DEFAULT_CONFIG correctly", () => {
      expect(DEFAULT_CONFIG.network).to.equal("devnet");
      expect(DEFAULT_CONFIG.programId.toBase58()).to.equal(
        LEAGUE_ESCROW_PROGRAM_ID.toBase58(),
      );
    });
  });
});
