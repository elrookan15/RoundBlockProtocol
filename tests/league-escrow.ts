import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { expect } from "chai";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";

describe("league-escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.LeagueEscrow as Program;
  const admin = (provider.wallet as anchor.Wallet).payer;
  const oracle = Keypair.generate();
  const player1 = Keypair.generate();
  const player2 = Keypair.generate();

  let mint: PublicKey;
  let player1TokenAccount: PublicKey;
  let player2TokenAccount: PublicKey;

  before(async () => {
    // Airdrop SOL to test accounts
    for (const kp of [oracle, player1, player2]) {
      const sig = await provider.connection.requestAirdrop(
        kp.publicKey,
        2 * LAMPORTS_PER_SOL,
      );
      await provider.connection.confirmTransaction(sig);
    }

    // Create SPL Token Mint
    mint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      6,
    );

    // Create SPL token accounts and mint tokens
    player1TokenAccount = await createAccount(
      provider.connection,
      admin,
      mint,
      player1.publicKey,
    );
    player2TokenAccount = await createAccount(
      provider.connection,
      admin,
      mint,
      player2.publicKey,
    );

    await mintTo(
      provider.connection,
      admin,
      mint,
      player1TokenAccount,
      admin,
      1000000000,
    );
    await mintTo(
      provider.connection,
      admin,
      mint,
      player2TokenAccount,
      admin,
      1000000000,
    );
  });

  describe("SOL League Lifecycle", () => {
    const leagueId = new anchor.BN(101);
    const entryFee = new anchor.BN(100000000); // 0.1 SOL
    const maxPlayers = 2;

    let leaguePda: PublicKey;
    let entry1Pda: PublicKey;
    let entry2Pda: PublicKey;

    before(() => {
      [leaguePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("league"),
          admin.publicKey.toBuffer(),
          leagueId.toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      [entry1Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("entry"),
          leaguePda.toBuffer(),
          player1.publicKey.toBuffer(),
        ],
        program.programId,
      );

      [entry2Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("entry"),
          leaguePda.toBuffer(),
          player2.publicKey.toBuffer(),
        ],
        program.programId,
      );
    });

    it("Fails to create a league with max_players = 0", async () => {
      const zeroId = new anchor.BN(999);
      const [zeroPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("league"),
          admin.publicKey.toBuffer(),
          zeroId.toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      try {
        await (program.methods as any)
          .createLeague(zeroId, entryFee, 0)
          .accounts({
            league: zeroPda,
            admin: admin.publicKey,
            oracle: oracle.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have failed with InvalidMaxPlayers");
      } catch (err: any) {
        expect(err.toString()).to.include("InvalidMaxPlayers");
      }
    });

    it("Creates a SOL league", async () => {
      await (program.methods as any)
        .createLeague(leagueId, entryFee, maxPlayers)
        .accounts({
          league: leaguePda,
          admin: admin.publicKey,
          oracle: oracle.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const account = await (program.account as any).league.fetch(leaguePda);
      expect(account.admin.toBase58()).to.equal(admin.publicKey.toBase58());
      expect(account.oracle.toBase58()).to.equal(oracle.publicKey.toBase58());
      expect(account.entryFee.toNumber()).to.equal(entryFee.toNumber());
      expect(account.maxPlayers).to.equal(maxPlayers);
      expect(account.playerCount).to.equal(0);
      expect(account.paymentMint).to.be.null;
    });

    it("Allows players to join SOL league", async () => {
      await (program.methods as any)
        .joinLeague()
        .accounts({
          league: leaguePda,
          entry: entry1Pda,
          player: player1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([player1])
        .rpc();

      await (program.methods as any)
        .joinLeague()
        .accounts({
          league: leaguePda,
          entry: entry2Pda,
          player: player2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([player2])
        .rpc();

      const account = await (program.account as any).league.fetch(leaguePda);
      expect(account.playerCount).to.equal(2);
      expect(account.totalPot.toNumber()).to.equal(200000000);
    });

    it("Locks the SOL league", async () => {
      await (program.methods as any)
        .lockLeague()
        .accounts({
          league: leaguePda,
          admin: admin.publicKey,
        })
        .rpc();

      const account = await (program.account as any).league.fetch(leaguePda);
      expect(account.status).to.deep.equal({ locked: {} });
    });

    it("Resolves the SOL league", async () => {
      const winners = [
        { winner: player1.publicKey, payout: new anchor.BN(150000000) },
        { winner: player2.publicKey, payout: new anchor.BN(50000000) },
      ];

      await (program.methods as any)
        .resolveLeague(winners)
        .accounts({
          league: leaguePda,
          authority: oracle.publicKey,
        })
        .signers([oracle])
        .rpc();

      const account = await (program.account as any).league.fetch(leaguePda);
      expect(account.status).to.deep.equal({ resolved: {} });
      expect(account.winners.length).to.equal(2);
    });

    it("Claims payout for player 1", async () => {
      const preBalance = await provider.connection.getBalance(
        player1.publicKey,
      );

      await (program.methods as any)
        .claimPayout()
        .accounts({
          league: leaguePda,
          winner: player1.publicKey,
        })
        .signers([player1])
        .rpc();

      const postBalance = await provider.connection.getBalance(
        player1.publicKey,
      );
      expect(postBalance).to.be.greaterThan(preBalance);
    });
  });

  describe("Large Capacity Dynamic Allocation League (>10 Players)", () => {
    const leagueId = new anchor.BN(303);
    const entryFee = new anchor.BN(10000000); // 0.01 SOL
    const maxPlayers = 12;

    let leaguePda: PublicKey;

    before(() => {
      [leaguePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("league"),
          admin.publicKey.toBuffer(),
          leagueId.toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );
    });

    it("Creates a large SOL league with max_players = 12", async () => {
      await (program.methods as any)
        .createLeague(leagueId, entryFee, maxPlayers)
        .accounts({
          league: leaguePda,
          admin: admin.publicKey,
          oracle: oracle.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const account = await (program.account as any).league.fetch(leaguePda);
      expect(account.maxPlayers).to.equal(12);
    });
  });

  describe("SPL/USDC League Lifecycle", () => {
    const leagueId = new anchor.BN(202);
    const entryFee = new anchor.BN(50000000); // 50 USDC
    const maxPlayers = 2;

    let leaguePda: PublicKey;
    let vaultPda: PublicKey;
    let entry1Pda: PublicKey;

    before(() => {
      [leaguePda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("league"),
          admin.publicKey.toBuffer(),
          leagueId.toArrayLike(Buffer, "le", 8),
        ],
        program.programId,
      );

      [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), leaguePda.toBuffer()],
        program.programId,
      );

      [entry1Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("entry"),
          leaguePda.toBuffer(),
          player1.publicKey.toBuffer(),
        ],
        program.programId,
      );
    });

    it("Creates an SPL league", async () => {
      await (program.methods as any)
        .createLeagueSpl(leagueId, entryFee, maxPlayers)
        .accounts({
          league: leaguePda,
          vault: vaultPda,
          paymentMint: mint,
          admin: admin.publicKey,
          oracle: oracle.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      const account = await (program.account as any).league.fetch(leaguePda);
      expect(account.paymentMint.toBase58()).to.equal(mint.toBase58());
    });

    it("Joins the SPL league", async () => {
      await (program.methods as any)
        .joinLeagueSpl()
        .accounts({
          league: leaguePda,
          entry: entry1Pda,
          vault: vaultPda,
          paymentMint: mint,
          playerToken: player1TokenAccount,
          player: player1.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([player1])
        .rpc();

      const vaultAccount = await getAccount(provider.connection, vaultPda);
      expect(Number(vaultAccount.amount)).to.equal(50000000);
    });
  });
});
