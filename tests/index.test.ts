import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
  LEAGUE_ESCROW_PROGRAM_ID,
  DEFAULT_CONFIG,
  findLeaguePda,
  findEntryPda,
  findVaultPda,
  leagueIdToBuffer,
} from "../index";

describe("index.ts Client Utility Suite", () => {
  const admin = PublicKey.default;
  const player = LEAGUE_ESCROW_PROGRAM_ID;

  describe("leagueIdToBuffer", () => {
    it("converts number, bigint, and BN deterministically", () => {
      const numBuf = leagueIdToBuffer(123456789);
      const bigBuf = leagueIdToBuffer(123456789n);
      const bnBuf = leagueIdToBuffer(new BN(123456789));

      expect(numBuf.toString("hex")).to.equal(bigBuf.toString("hex"));
      expect(numBuf.toString("hex")).to.equal(bnBuf.toString("hex"));
      expect(numBuf.length).to.equal(8);
      expect(numBuf.readBigUInt64LE(0)).to.equal(123456789n);
    });

    it("handles u64 edge cases (0 and u64 max)", () => {
      const zeroBuf = leagueIdToBuffer(0n);
      expect(zeroBuf.readBigUInt64LE(0)).to.equal(0n);

      const maxU64 = BigInt("18446744073709551615");
      const maxBuf = leagueIdToBuffer(maxU64);
      expect(maxBuf.readBigUInt64LE(0)).to.equal(maxU64);

      const maxBnBuf = leagueIdToBuffer(new BN("18446744073709551615"));
      expect(maxBnBuf.toString("hex")).to.equal(maxBuf.toString("hex"));
    });

    it("throws RangeError for negative inputs", () => {
      expect(() => leagueIdToBuffer(-1)).to.throw(RangeError, "negative");
      expect(() => leagueIdToBuffer(-1n)).to.throw(RangeError, "negative");
      expect(() => leagueIdToBuffer(new BN(-1))).to.throw(
        RangeError,
        "negative",
      );
    });

    it("throws RangeError for values exceeding u64 max", () => {
      const overU64 = BigInt("18446744073709551616");
      expect(() => leagueIdToBuffer(overU64)).to.throw(
        RangeError,
        "exceeds u64 maximum bounds",
      );

      const overBn = new BN("18446744073709551616");
      expect(() => leagueIdToBuffer(overBn)).to.throw(Error);
    });

    it("throws TypeError for non-integer numbers and invalid types", () => {
      expect(() => leagueIdToBuffer(12.34)).to.throw(
        TypeError,
        "must be an integer",
      );
      expect(() => leagueIdToBuffer("123" as any)).to.throw(
        TypeError,
        "Invalid league ID type",
      );
    });
  });

  describe("PDA Derivations", () => {
    it("derives league PDA deterministically across input types", () => {
      const [pda1, bump1] = findLeaguePda(admin, 42);
      const [pda2, bump2] = findLeaguePda(admin, 42n);
      const [pda3, bump3] = findLeaguePda(admin, new BN(42));

      expect(pda1.toBase58()).to.equal(pda2.toBase58());
      expect(pda1.toBase58()).to.equal(pda3.toBase58());
      expect(bump1).to.equal(bump2);
      expect(bump1).to.equal(bump3);
    });

    it("derives entry PDA and vault PDA correctly", () => {
      const [leaguePda] = findLeaguePda(admin, 100);
      const [entryPda, entryBump] = findEntryPda(leaguePda, player);
      const [vaultPda, vaultBump] = findVaultPda(leaguePda);

      expect(entryPda).to.be.an.instanceOf(PublicKey);
      expect(typeof entryBump).to.equal("number");
      expect(vaultPda).to.be.an.instanceOf(PublicKey);
      expect(typeof vaultBump).to.equal("number");
    });
  });

  describe("Exports & Configuration", () => {
    it("exports valid default config and program ID", () => {
      expect(DEFAULT_CONFIG.programId.toBase58()).to.equal(
        LEAGUE_ESCROW_PROGRAM_ID.toBase58(),
      );
      expect(DEFAULT_CONFIG.network).to.equal("devnet");
    });
  });
});
