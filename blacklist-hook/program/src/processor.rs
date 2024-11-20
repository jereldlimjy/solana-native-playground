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
    system_instruction, system_program,
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
                BlacklistInstruction::AddToBlacklist { address } => {
                    add_to_blacklist(program_id, accounts, address)
                }
                BlacklistInstruction::RemoveFromBlacklist { address } => {
                    remove_from_blacklist(program_id, accounts, address)
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

    let account_info_iter = &mut accounts.iter();

    let admin_account = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;

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

pub fn add_to_blacklist(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    blacklist_address: Pubkey,
) -> ProgramResult {
    msg!("Blacklisting address {}...", blacklist_address);

    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let admin_pda_account = next_account_info(account_info_iter)?;
    let blacklist_pda_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    if !initializer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // verify admin PDA and authority
    let (expected_admin_pda, _) = Pubkey::find_program_address(&["admin".as_bytes()], program_id);

    if *admin_pda_account.key != expected_admin_pda {
        return Err(ProgramError::InvalidArgument);
    }

    let admin_account_data = AdminAccountState::try_from_slice(&admin_pda_account.data.borrow())
        .map_err(|_| ProgramError::InvalidAccountData)?;

    if !admin_account_data.is_initialized {
        return Err(ProgramError::InvalidAccountData);
    }

    if *initializer.key != admin_account_data.admin {
        return Err(ProgramError::IncorrectAuthority);
    }

    // initialize blacklist account - no data needed
    let (expected_blacklist_pda, bump_seed) = Pubkey::find_program_address(
        &[
            "blacklist".as_bytes(),
            blacklist_address.to_bytes().as_ref(),
        ],
        program_id,
    );

    if *blacklist_pda_account.key != expected_blacklist_pda {
        return Err(ProgramError::InvalidArgument);
    }

    invoke_signed(
        &system_instruction::create_account(
            initializer.key,
            &expected_blacklist_pda,
            Rent::get()?.minimum_balance(0),
            0,
            program_id,
        ),
        &[
            initializer.clone(),
            blacklist_pda_account.clone(),
            system_program.clone(),
        ],
        &[&[
            "blacklist".as_bytes().as_ref(),
            blacklist_address.to_bytes().as_ref(),
            &[bump_seed],
        ]],
    )?;

    msg!("Blacklist PDA account created: {}", expected_blacklist_pda);

    Ok(())
}

pub fn remove_from_blacklist(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    blacklist_address: Pubkey,
) -> ProgramResult {
    msg!("Removing address {} from blacklist...", blacklist_address);

    let account_info_iter = &mut accounts.iter();

    let admin_account = next_account_info(account_info_iter)?;
    let admin_pda_account = next_account_info(account_info_iter)?;
    let blacklist_pda_account = next_account_info(account_info_iter)?;

    if !admin_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // verify admin PDA and authority
    let (expected_admin_pda, _) = Pubkey::find_program_address(&["admin".as_bytes()], program_id);

    if *admin_pda_account.key != expected_admin_pda {
        return Err(ProgramError::InvalidArgument);
    }

    let admin_account_data = AdminAccountState::try_from_slice(&admin_pda_account.data.borrow())
        .map_err(|_| ProgramError::InvalidAccountData)?;

    if !admin_account_data.is_initialized {
        return Err(ProgramError::InvalidAccountData);
    }

    if *admin_account.key != admin_account_data.admin {
        return Err(ProgramError::IncorrectAuthority);
    }

    // close blacklist account
    let (expected_blacklist_pda, _) = Pubkey::find_program_address(
        &[
            "blacklist".as_bytes(),
            blacklist_address.to_bytes().as_ref(),
        ],
        program_id,
    );

    if *blacklist_pda_account.key != expected_blacklist_pda {
        return Err(ProgramError::InvalidArgument);
    }

    let dest_starting_lamports = admin_account.lamports();

    **admin_account.lamports.borrow_mut() = dest_starting_lamports
        .checked_add(blacklist_pda_account.lamports())
        .ok_or(ProgramError::ArithmeticOverflow)?;
    **blacklist_pda_account.lamports.borrow_mut() = 0;

    let mut data = blacklist_pda_account.try_borrow_mut_data()?;
    for byte in data.iter_mut() {
        *byte = 0;
    }

    msg!("Blacklist PDA account {} closed", expected_blacklist_pda);

    Ok(())
}
