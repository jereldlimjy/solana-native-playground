use crate::{instruction::BlacklistInstruction, state::AdminAccountState};
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};
use spl_transfer_hook_interface::instruction::TransferHookInstruction;

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    match TransferHookInstruction::unpack(instruction_data) {
        Ok(hook_instruction) => match hook_instruction {
            TransferHookInstruction::Execute { amount } => msg!("execute"),
            TransferHookInstruction::InitializeExtraAccountMetaList {
                extra_account_metas,
            } => msg!("initialize ExtraAccountMetaList"),
            TransferHookInstruction::UpdateExtraAccountMetaList {
                extra_account_metas,
            } => msg!("update ExtraAccountMetaList"),
        },
        Err(_) => {
            let instruction = BlacklistInstruction::unpack(instruction_data)?;

            return match instruction {
                BlacklistInstruction::InitializeAdmin { admin } => {
                    initialize_admin(program_id, accounts, admin)
                }
                BlacklistInstruction::UpdateAdmin { new_admin } => {
                    update_admin(program_id, accounts, new_admin)
                }
            };
        }
    }

    Ok(())
}

pub fn initialize_admin(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    admin: Pubkey,
) -> ProgramResult {
    msg!("Initializing admin account...");

    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    if !initializer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let (pda, bump_seed) = Pubkey::find_program_address(&["admin".as_bytes().as_ref()], program_id);

    if *pda_account.key != pda {
        return Err(ProgramError::InvalidArgument);
    }

    let account_len = 1 + 32;
    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(account_len);

    invoke_signed(
        &system_instruction::create_account(
            initializer.key,
            &pda,
            rent_lamports,
            account_len.try_into().unwrap(),
            program_id,
        ),
        &[
            initializer.clone(),
            pda_account.clone(),
            system_program.clone(),
        ],
        &[&["admin".as_bytes().as_ref(), &[bump_seed]]],
    )?;

    msg!("PDA created: {}", pda);

    let mut account_data = AdminAccountState::try_from_slice(&pda_account.data.borrow())
        .map_err(|_| ProgramError::InvalidAccountData)?;

    if account_data.is_initialized {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    account_data.is_initialized = true;
    account_data.admin = admin;

    account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;

    Ok(())
}

pub fn update_admin(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    new_admin: Pubkey,
) -> ProgramResult {
    msg!("Updating admin account...");
    let accounts_iter = &mut accounts.iter();

    let admin_account = next_account_info(accounts_iter)?;
    let pda_account = next_account_info(accounts_iter)?;

    if !admin_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let (expected_pda, _) = Pubkey::find_program_address(&["admin".as_bytes()], program_id);
    if *pda_account.key != expected_pda {
        return Err(ProgramError::InvalidArgument);
    }

    // deserialize pda_account data
    let mut account_data = AdminAccountState::try_from_slice(&pda_account.data.borrow())
        .map_err(|_| ProgramError::InvalidAccountData)?;

    if !account_data.is_initialized {
        return Err(ProgramError::InvalidAccountData);
    }

    if account_data.admin != *admin_account.key {
        return Err(ProgramError::IncorrectAuthority);
    }

    msg!(
        "Updating admin from {} to {}",
        account_data.admin,
        new_admin
    );

    account_data.admin = new_admin;

    account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;

    Ok(())
}
