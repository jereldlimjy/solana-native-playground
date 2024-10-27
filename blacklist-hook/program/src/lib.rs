pub mod instruction;
pub mod state;

use instruction::BlacklistInstruction;
use solana_program::{
    account_info::AccountInfo, entrypoint, entrypoint::ProgramResult, msg, pubkey::Pubkey,
};
use spl_transfer_hook_interface::instruction::{
    ExecuteInstruction, InitializeExtraAccountMetaListInstruction, TransferHookInstruction,
};

entrypoint!(process_instruction);

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

            match instruction {
                BlacklistInstruction::InitializeAdmin { admin } => {}
                BlacklistInstruction::UpdateAdmin { new_admin } => {}
            }
        }
    }

    Ok(())
}
