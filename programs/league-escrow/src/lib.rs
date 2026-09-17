use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("YG5dVJydevZcHJQtLNirYUseJtYQQoK83uPMznXVUbW");

pub const MAX_LEAGUE_PLAYERS: u8 = 200;

#[program]
pub mod league_escrow {
    use super::*;

    pub fn create_league(
        ctx: Context<CreateLeague>,
        league_id: u64,
        entry_fee: u64,
        max_players: u8,
    ) -> Result<()> {
        require!(
            max_players > 0 && max_players <= MAX_LEAGUE_PLAYERS,
            ErrorCode::InvalidMaxPlayers
        );

        let league = &mut ctx.accounts.league;
        league.admin = ctx.accounts.admin.key();
        league.oracle = ctx.accounts.oracle.key();
        league.league_id = league_id;
        league.entry_fee = entry_fee;
        league.max_players = max_players;
        league.player_count = 0;
        league.status = LeagueStatus::Open;
        league.total_pot = 0;
        league.payment_mint = None;
        league.winners = Vec::with_capacity(max_players as usize);
        league.bump = ctx.bumps.league;
        league.vault_bump = 0;

        let league_key = league.key();
        emit!(LeagueCreatedEvent {
            league: league_key,
            admin: ctx.accounts.admin.key(),
            oracle: ctx.accounts.oracle.key(),
            league_id,
            entry_fee,
            max_players,
            payment_mint: None,
        });

        Ok(())
    }

    pub fn create_league_spl(
        ctx: Context<CreateLeagueSpl>,
        league_id: u64,
        entry_fee: u64,
        max_players: u8,
    ) -> Result<()> {
        require!(
            max_players > 0 && max_players <= MAX_LEAGUE_PLAYERS,
            ErrorCode::InvalidMaxPlayers
        );

        let league = &mut ctx.accounts.league;
        league.admin = ctx.accounts.admin.key();
        league.oracle = ctx.accounts.oracle.key();
        league.league_id = league_id;
        league.entry_fee = entry_fee;
        league.max_players = max_players;
        league.player_count = 0;
        league.status = LeagueStatus::Open;
        league.total_pot = 0;
        league.payment_mint = Some(ctx.accounts.payment_mint.key());
        league.winners = Vec::with_capacity(max_players as usize);
        league.bump = ctx.bumps.league;
        league.vault_bump = ctx.bumps.vault;

        let league_key = league.key();
        emit!(LeagueCreatedEvent {
            league: league_key,
            admin: ctx.accounts.admin.key(),
            oracle: ctx.accounts.oracle.key(),
            league_id,
            entry_fee,
            max_players,
            payment_mint: Some(ctx.accounts.payment_mint.key()),
        });

        Ok(())
    }

    pub fn join_league(ctx: Context<JoinLeague>) -> Result<()> {
        let league = &mut ctx.accounts.league;
        require!(league.status == LeagueStatus::Open, ErrorCode::LeagueNotOpen);
        require!(league.payment_mint.is_none(), ErrorCode::WrongCurrency);
        require!(league.player_count < league.max_players, ErrorCode::LeagueFull);

        let entry_fee = league.entry_fee;
        if entry_fee > 0 {
            let cpi_context = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.player.to_account_info(),
                    to: league.to_account_info(),
                },
            );
            anchor_lang::system_program::transfer(cpi_context, entry_fee)?;
        }

        let entry = &mut ctx.accounts.entry;
        entry.league = league.key();
        entry.player = ctx.accounts.player.key();
        entry.bump = ctx.bumps.entry;

        league.player_count = league.player_count.checked_add(1).ok_or(ErrorCode::Overflow)?;
        league.total_pot = league.total_pot.checked_add(entry_fee).ok_or(ErrorCode::Overflow)?;

        let league_key = league.key();
        let player_count = league.player_count;
        let total_pot = league.total_pot;

        emit!(PlayerJoinedEvent {
            league: league_key,
            player: ctx.accounts.player.key(),
            player_count,
            total_pot,
        });

        Ok(())
    }

    pub fn join_league_spl(ctx: Context<JoinLeagueSpl>) -> Result<()> {
        let league = &mut ctx.accounts.league;
        require!(league.status == LeagueStatus::Open, ErrorCode::LeagueNotOpen);
        let payment_mint = league.payment_mint.ok_or(ErrorCode::WrongCurrency)?;
        require!(payment_mint == ctx.accounts.payment_mint.key(), ErrorCode::WrongCurrency);
        require!(league.player_count < league.max_players, ErrorCode::LeagueFull);

        let entry_fee = league.entry_fee;
        if entry_fee > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.player_token.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.player.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            token::transfer(cpi_ctx, entry_fee)?;
        }

        let entry = &mut ctx.accounts.entry;
        entry.league = league.key();
        entry.player = ctx.accounts.player.key();
        entry.bump = ctx.bumps.entry;

        league.player_count = league.player_count.checked_add(1).ok_or(ErrorCode::Overflow)?;
        league.total_pot = league.total_pot.checked_add(entry_fee).ok_or(ErrorCode::Overflow)?;

        let league_key = league.key();
        let player_count = league.player_count;
        let total_pot = league.total_pot;

        emit!(PlayerJoinedEvent {
            league: league_key,
            player: ctx.accounts.player.key(),
            player_count,
            total_pot,
        });

        Ok(())
    }

    pub fn lock_league(ctx: Context<LockLeague>) -> Result<()> {
        let league = &mut ctx.accounts.league;
        require!(league.status == LeagueStatus::Open, ErrorCode::LeagueNotOpen);
        league.status = LeagueStatus::Locked;

        let league_key = league.key();
        emit!(LeagueLockedEvent {
            league: league_key,
            admin: ctx.accounts.admin.key(),
        });

        Ok(())
    }

    pub fn resolve_league(
        ctx: Context<ResolveLeague>,
        winner_inputs: Vec<WinnerInput>,
    ) -> Result<()> {
        let league = &mut ctx.accounts.league;
        require!(league.status == LeagueStatus::Locked, ErrorCode::LeagueNotLocked);
        let signer = ctx.accounts.authority.key();
        require!(
            signer == league.admin || signer == league.oracle,
            ErrorCode::Unauthorized
        );

        require!(!winner_inputs.is_empty(), ErrorCode::InvalidWinners);
        require!(
            winner_inputs.len() <= league.max_players as usize,
            ErrorCode::InvalidWinners
        );

        let league_key = league.key();
        let mut total_payout: u64 = 0;
        let mut winners = Vec::with_capacity(winner_inputs.len());

        for input in &winner_inputs {
            total_payout = total_payout.checked_add(input.payout).ok_or(ErrorCode::Overflow)?;
            require!(
                !winners.iter().any(|w: &WinnerSplit| w.winner == input.winner),
                ErrorCode::InvalidWinners
            );

            if !ctx.remaining_accounts.is_empty() {
                let (expected_entry_pda, _) = Pubkey::find_program_address(
                    &[b"entry", league_key.as_ref(), input.winner.as_ref()],
                    ctx.program_id,
                );
                let entry_acc = ctx
                    .remaining_accounts
                    .iter()
                    .find(|acc| acc.key() == expected_entry_pda)
                    .ok_or(ErrorCode::InvalidWinnerEntry)?;
                require!(
                    entry_acc.owner == ctx.program_id,
                    ErrorCode::InvalidWinnerEntry
                );
            }

            winners.push(WinnerSplit {
                winner: input.winner,
                payout: input.payout,
                claimed: false,
            });
        }

        require!(total_payout <= league.total_pot, ErrorCode::ExceedsTotalPot);
        require!(winners.len() <= league.player_count as usize, ErrorCode::InvalidWinners);

        league.winners = winners;
        league.status = LeagueStatus::Resolved;

        emit!(LeagueResolvedEvent {
            league: league_key,
            authority: signer,
            winner_count: league.winners.len() as u8,
            total_payout,
        });

        Ok(())
    }

    pub fn claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
        let league = &mut ctx.accounts.league;
        require!(league.status == LeagueStatus::Resolved, ErrorCode::LeagueNotResolved);
        require!(league.payment_mint.is_none(), ErrorCode::WrongCurrency);

        let winner_pubkey = ctx.accounts.winner.key();
        let winner_split = league
            .winners
            .iter_mut()
            .find(|w| w.winner == winner_pubkey)
            .ok_or(ErrorCode::WinnerNotFound)?;

        require!(!winner_split.claimed, ErrorCode::AlreadyClaimed);
        let payout = winner_split.payout;
        winner_split.claimed = true;

        if payout > 0 {
            let league_info = league.to_account_info();
            let min_rent = Rent::get()?.minimum_balance(league_info.data_len());
            let current_lamports = league_info.lamports();

            require!(
                current_lamports.saturating_sub(payout) >= min_rent,
                ErrorCode::InsufficientFunds
            );

            **league_info.try_borrow_mut_lamports()? = current_lamports
                .checked_sub(payout)
                .ok_or(ErrorCode::Overflow)?;
            **ctx.accounts.winner.try_borrow_mut_lamports()? = ctx
                .accounts
                .winner
                .lamports()
                .checked_add(payout)
                .ok_or(ErrorCode::Overflow)?;
        }

        let league_key = league.key();
        emit!(PayoutClaimedEvent {
            league: league_key,
            winner: winner_pubkey,
            payout,
        });

        Ok(())
    }

    pub fn claim_payout_spl(ctx: Context<ClaimPayoutSpl>) -> Result<()> {
        let league = &mut ctx.accounts.league;
        require!(league.status == LeagueStatus::Resolved, ErrorCode::LeagueNotResolved);
        let payment_mint = league.payment_mint.ok_or(ErrorCode::WrongCurrency)?;
        require!(payment_mint == ctx.accounts.payment_mint.key(), ErrorCode::WrongCurrency);

        let winner_pubkey = ctx.accounts.winner.key();
        let winner_split = league
            .winners
            .iter_mut()
            .find(|w| w.winner == winner_pubkey)
            .ok_or(ErrorCode::WinnerNotFound)?;

        require!(!winner_split.claimed, ErrorCode::AlreadyClaimed);
        let payout = winner_split.payout;
        winner_split.claimed = true;

        if payout > 0 {
            let admin_key = league.admin;
            let league_id_bytes = league.league_id.to_le_bytes();
            let bump = league.bump;
            let seeds = &[
                b"league",
                admin_key.as_ref(),
                league_id_bytes.as_ref(),
                &[bump],
            ];
            let signer_seeds = &[&seeds[..]];

            let cpi_accounts = Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.winner_token.to_account_info(),
                authority: league.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
            token::transfer(cpi_ctx, payout)?;
        }

        let league_key = league.key();
        emit!(PayoutClaimedEvent {
            league: league_key,
            winner: winner_pubkey,
            payout,
        });

        Ok(())
    }

    pub fn cancel_league(ctx: Context<CancelLeague>) -> Result<()> {
        let league = &mut ctx.accounts.league;
        require!(league.status == LeagueStatus::Open, ErrorCode::LeagueNotOpen);
        league.status = LeagueStatus::Cancelled;

        let league_key = league.key();
        emit!(LeagueCancelledEvent {
            league: league_key,
            admin: ctx.accounts.admin.key(),
        });

        Ok(())
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let league = &mut ctx.accounts.league;
        require!(league.status == LeagueStatus::Cancelled, ErrorCode::LeagueNotCancelled);
        require!(league.payment_mint.is_none(), ErrorCode::WrongCurrency);

        let entry_fee = league.entry_fee;

        if entry_fee > 0 {
            let league_info = league.to_account_info();
            let min_rent = Rent::get()?.minimum_balance(league_info.data_len());
            let current_lamports = league_info.lamports();

            require!(
                current_lamports.saturating_sub(entry_fee) >= min_rent,
                ErrorCode::InsufficientFunds
            );

            **league_info.try_borrow_mut_lamports()? = current_lamports
                .checked_sub(entry_fee)
                .ok_or(ErrorCode::Overflow)?;
            **ctx.accounts.player.try_borrow_mut_lamports()? = ctx
                .accounts
                .player
                .lamports()
                .checked_add(entry_fee)
                .ok_or(ErrorCode::Overflow)?;
        }

        league.player_count = league.player_count.checked_sub(1).ok_or(ErrorCode::Overflow)?;
        league.total_pot = league.total_pot.checked_sub(entry_fee).ok_or(ErrorCode::Overflow)?;

        let league_key = league.key();
        emit!(PlayerRefundedEvent {
            league: league_key,
            player: ctx.accounts.player.key(),
            refund_amount: entry_fee,
        });

        Ok(())
    }

    pub fn refund_spl(ctx: Context<RefundSpl>) -> Result<()> {
        let league = &mut ctx.accounts.league;
        require!(league.status == LeagueStatus::Cancelled, ErrorCode::LeagueNotCancelled);
        let payment_mint = league.payment_mint.ok_or(ErrorCode::WrongCurrency)?;
        require!(payment_mint == ctx.accounts.payment_mint.key(), ErrorCode::WrongCurrency);

        let entry_fee = league.entry_fee;

        if entry_fee > 0 {
            let admin_key = league.admin;
            let league_id_bytes = league.league_id.to_le_bytes();
            let bump = league.bump;
            let seeds = &[
                b"league",
                admin_key.as_ref(),
                league_id_bytes.as_ref(),
                &[bump],
            ];
            let signer_seeds = &[&seeds[..]];

            let cpi_accounts = Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.player_token.to_account_info(),
                authority: league.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
            token::transfer(cpi_ctx, entry_fee)?;
        }

        league.player_count = league.player_count.checked_sub(1).ok_or(ErrorCode::Overflow)?;
        league.total_pot = league.total_pot.checked_sub(entry_fee).ok_or(ErrorCode::Overflow)?;

        let league_key = league.key();
        emit!(PlayerRefundedEvent {
            league: league_key,
            player: ctx.accounts.player.key(),
            refund_amount: entry_fee,
        });

        Ok(())
    }

    pub fn close_league(ctx: Context<CloseLeague>) -> Result<()> {
        let league = &ctx.accounts.league;
        require!(league.admin == ctx.accounts.admin.key(), ErrorCode::Unauthorized);

        match league.status {
            LeagueStatus::Resolved => {
                require!(
                    league.winners.iter().all(|w| w.claimed),
                    ErrorCode::UnclaimedPayouts
                );
            }
            LeagueStatus::Cancelled => {
                require!(
                    league.player_count == 0,
                    ErrorCode::UnclaimedRefunds
                );
            }
            _ => return err!(ErrorCode::InvalidLeagueStatus),
        }

        let league_key = league.key();
        emit!(LeagueClosedEvent {
            league: league_key,
            admin: ctx.accounts.admin.key(),
        });

        Ok(())
    }

    pub fn close_league_spl(ctx: Context<CloseLeagueSpl>) -> Result<()> {
        let league = &ctx.accounts.league;
        require!(league.admin == ctx.accounts.admin.key(), ErrorCode::Unauthorized);

        match league.status {
            LeagueStatus::Resolved => {
                require!(
                    league.winners.iter().all(|w| w.claimed),
                    ErrorCode::UnclaimedPayouts
                );
            }
            LeagueStatus::Cancelled => {
                require!(
                    league.player_count == 0,
                    ErrorCode::UnclaimedRefunds
                );
            }
            _ => return err!(ErrorCode::InvalidLeagueStatus),
        }

        let admin_key = league.admin;
        let league_id_bytes = league.league_id.to_le_bytes();
        let bump = league.bump;
        let seeds = &[
            b"league",
            admin_key.as_ref(),
            league_id_bytes.as_ref(),
            &[bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = token::CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            destination: ctx.accounts.admin.to_account_info(),
            authority: league.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        token::close_account(cpi_ctx)?;

        let league_key = league.key();
        emit!(LeagueClosedEvent {
            league: league_key,
            admin: ctx.accounts.admin.key(),
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(league_id: u64, entry_fee: u64, max_players: u8)]
pub struct CreateLeague<'info> {
    #[account(
        init,
        payer = admin,
        space = League::space(max_players),
        seeds = [b"league", admin.key().as_ref(), league_id.to_le_bytes().as_ref()],
        bump
    )]
    pub league: Account<'info, League>,
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: Oracle authority for setting resolution
    pub oracle: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(league_id: u64, entry_fee: u64, max_players: u8)]
pub struct CreateLeagueSpl<'info> {
    #[account(
        init,
        payer = admin,
        space = League::space(max_players),
        seeds = [b"league", admin.key().as_ref(), league_id.to_le_bytes().as_ref()],
        bump
    )]
    pub league: Account<'info, League>,
    #[account(
        init,
        payer = admin,
        token::mint = payment_mint,
        token::authority = league,
        seeds = [b"vault", league.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    pub payment_mint: Account<'info, Mint>,
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: Oracle authority for setting resolution
    pub oracle: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct JoinLeague<'info> {
    #[account(
        mut,
        seeds = [b"league", league.admin.as_ref(), league.league_id.to_le_bytes().as_ref()],
        bump = league.bump,
    )]
    pub league: Account<'info, League>,
    #[account(
        init,
        payer = player,
        space = PlayerEntry::LEN,
        seeds = [b"entry", league.key().as_ref(), player.key().as_ref()],
        bump
    )]
    pub entry: Account<'info, PlayerEntry>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinLeagueSpl<'info> {
    #[account(
        mut,
        seeds = [b"league", league.admin.as_ref(), league.league_id.to_le_bytes().as_ref()],
        bump = league.bump,
    )]
    pub league: Account<'info, League>,
    #[account(
        init,
        payer = player,
        space = PlayerEntry::LEN,
        seeds = [b"entry", league.key().as_ref(), player.key().as_ref()],
        bump
    )]
    pub entry: Account<'info, PlayerEntry>,
    #[account(
        mut,
        seeds = [b"vault", league.key().as_ref()],
        bump = league.vault_bump,
        token::mint = payment_mint,
        token::authority = league,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub payment_mint: Account<'info, Mint>,
    #[account(
        mut,
        token::mint = payment_mint,
    )]
    pub player_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct LockLeague<'info> {
    #[account(
        mut,
        has_one = admin,
        seeds = [b"league", league.admin.as_ref(), league.league_id.to_le_bytes().as_ref()],
        bump = league.bump,
    )]
    pub league: Account<'info, League>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveLeague<'info> {
    #[account(
        mut,
        seeds = [b"league", league.admin.as_ref(), league.league_id.to_le_bytes().as_ref()],
        bump = league.bump,
    )]
    pub league: Account<'info, League>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimPayout<'info> {
    #[account(
        mut,
        seeds = [b"league", league.admin.as_ref(), league.league_id.to_le_bytes().as_ref()],
        bump = league.bump,
    )]
    pub league: Account<'info, League>,
    #[account(mut)]
    pub winner: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimPayoutSpl<'info> {
    #[account(
        mut,
        seeds = [b"league", league.admin.as_ref(), league.league_id.to_le_bytes().as_ref()],
        bump = league.bump,
    )]
    pub league: Account<'info, League>,
    #[account(
        mut,
        seeds = [b"vault", league.key().as_ref()],
        bump = league.vault_bump,
        token::mint = payment_mint,
        token::authority = league,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub payment_mint: Account<'info, Mint>,
    #[account(
        mut,
        token::mint = payment_mint,
    )]
    pub winner_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub winner: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelLeague<'info> {
    #[account(
        mut,
        has_one = admin,
        seeds = [b"league", league.admin.as_ref(), league.league_id.to_le_bytes().as_ref()],
        bump = league.bump,
    )]
    pub league: Account<'info, League>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(
        mut,
        seeds = [b"league", league.admin.as_ref(), league.league_id.to_le_bytes().as_ref()],
        bump = league.bump,
    )]
    pub league: Account<'info, League>,
    #[account(
        mut,
        close = player,
        seeds = [b"entry", league.key().as_ref(), player.key().as_ref()],
        bump = entry.bump,
    )]
    pub entry: Account<'info, PlayerEntry>,
    #[account(mut)]
    pub player: Signer<'info>,
}

#[derive(Accounts)]
pub struct RefundSpl<'info> {
    #[account(
        mut,
        seeds = [b"league", league.admin.as_ref(), league.league_id.to_le_bytes().as_ref()],
        bump = league.bump,
    )]
    pub league: Account<'info, League>,
    #[account(
        mut,
        close = player,
        seeds = [b"entry", league.key().as_ref(), player.key().as_ref()],
        bump = entry.bump,
    )]
    pub entry: Account<'info, PlayerEntry>,
    #[account(
        mut,
        seeds = [b"vault", league.key().as_ref()],
        bump = league.vault_bump,
        token::mint = payment_mint,
        token::authority = league,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub payment_mint: Account<'info, Mint>,
    #[account(
        mut,
        token::mint = payment_mint,
    )]
    pub player_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CloseLeague<'info> {
    #[account(
        mut,
        close = admin,
        has_one = admin,
        seeds = [b"league", admin.key().as_ref(), league.league_id.to_le_bytes().as_ref()],
        bump = league.bump,
    )]
    pub league: Account<'info, League>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseLeagueSpl<'info> {
    #[account(
        mut,
        close = admin,
        has_one = admin,
        seeds = [b"league", admin.key().as_ref(), league.league_id.to_le_bytes().as_ref()],
        bump = league.bump,
    )]
    pub league: Account<'info, League>,
    #[account(
        mut,
        seeds = [b"vault", league.key().as_ref()],
        bump = league.vault_bump,
        token::mint = payment_mint,
        token::authority = league,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub payment_mint: Account<'info, Mint>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct League {
    pub admin: Pubkey,
    pub oracle: Pubkey,
    pub league_id: u64,
    pub entry_fee: u64,
    pub max_players: u8,
    pub player_count: u8,
    pub status: LeagueStatus,
    pub total_pot: u64,
    pub payment_mint: Option<Pubkey>,
    pub winners: Vec<WinnerSplit>,
    pub bump: u8,
    pub vault_bump: u8,
}

impl League {
    pub fn space(max_players: u8) -> usize {
        8   // discriminator
        + 32 // admin
        + 32 // oracle
        + 8  // league_id
        + 8  // entry_fee
        + 1  // max_players
        + 1  // player_count
        + 1  // status
        + 8  // total_pot
        + 33 // payment_mint: Option<Pubkey> (1 + 32)
        + 4 + (max_players as usize) * (32 + 8 + 1) // winners
        + 1  // bump
        + 1  // vault_bump
    }
}

#[account]
pub struct PlayerEntry {
    pub league: Pubkey,
    pub player: Pubkey,
    pub bump: u8,
}

impl PlayerEntry {
    pub const LEN: usize = 8 + 32 + 32 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum LeagueStatus {
    Open,
    Locked,
    Resolved,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct WinnerSplit {
    pub winner: Pubkey,
    pub payout: u64,
    pub claimed: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct WinnerInput {
    pub winner: Pubkey,
    pub payout: u64,
}

#[event]
pub struct LeagueCreatedEvent {
    pub league: Pubkey,
    pub admin: Pubkey,
    pub oracle: Pubkey,
    pub league_id: u64,
    pub entry_fee: u64,
    pub max_players: u8,
    pub payment_mint: Option<Pubkey>,
}

#[event]
pub struct PlayerJoinedEvent {
    pub league: Pubkey,
    pub player: Pubkey,
    pub player_count: u8,
    pub total_pot: u64,
}

#[event]
pub struct LeagueLockedEvent {
    pub league: Pubkey,
    pub admin: Pubkey,
}

#[event]
pub struct LeagueResolvedEvent {
    pub league: Pubkey,
    pub authority: Pubkey,
    pub winner_count: u8,
    pub total_payout: u64,
}

#[event]
pub struct PayoutClaimedEvent {
    pub league: Pubkey,
    pub winner: Pubkey,
    pub payout: u64,
}

#[event]
pub struct LeagueCancelledEvent {
    pub league: Pubkey,
    pub admin: Pubkey,
}

#[event]
pub struct PlayerRefundedEvent {
    pub league: Pubkey,
    pub player: Pubkey,
    pub refund_amount: u64,
}

#[event]
pub struct LeagueClosedEvent {
    pub league: Pubkey,
    pub admin: Pubkey,
}

#[error_code]
pub enum ErrorCode {
    #[msg("League is not in Open status.")]
    LeagueNotOpen,
    #[msg("League is not in Locked status.")]
    LeagueNotLocked,
    #[msg("League is not in Resolved status.")]
    LeagueNotResolved,
    #[msg("League is not in Cancelled status.")]
    LeagueNotCancelled,
    #[msg("League has reached maximum player capacity.")]
    LeagueFull,
    #[msg("Mismatched currency for this league.")]
    WrongCurrency,
    #[msg("Unauthorized access.")]
    Unauthorized,
    #[msg("Invalid winners specification.")]
    InvalidWinners,
    #[msg("Winner not found in league payouts.")]
    WinnerNotFound,
    #[msg("Payout already claimed.")]
    AlreadyClaimed,
    #[msg("Total payouts exceed total pot.")]
    ExceedsTotalPot,
    #[msg("Arithmetic overflow.")]
    Overflow,
    #[msg("Max players must be greater than zero and at most 200.")]
    InvalidMaxPlayers,
    #[msg("Insufficient funds in escrow vault/account.")]
    InsufficientFunds,
    #[msg("Unclaimed payouts remain in the league.")]
    UnclaimedPayouts,
    #[msg("Unclaimed refunds remain in the league.")]
    UnclaimedRefunds,
    #[msg("League status does not allow closing.")]
    InvalidLeagueStatus,
    #[msg("Invalid winner entry account.")]
    InvalidWinnerEntry,
}
