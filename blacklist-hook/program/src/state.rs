use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

#[derive(BorshDeserialize, BorshSerialize)]
pub struct AdminAccountState {
    pub is_initialized: bool,
    pub admin: Pubkey,
}
