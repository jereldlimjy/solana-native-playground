use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{program_error::ProgramError, pubkey::Pubkey};

#[derive(BorshSerialize, BorshDeserialize)]
pub struct InitializeAdminPayload {
    pub admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct UpdateAdminPayload {
    pub new_admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct AddToBlacklistPayload {
    pub address: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct RemoveFromBlacklistPayload {
    pub address: Pubkey,
}

pub enum BlacklistInstruction {
    InitializeAdmin { admin: Pubkey },
    UpdateAdmin { new_admin: Pubkey },
    AddToBlacklist { address: Pubkey },
    RemoveFromBlacklist { address: Pubkey },
}

impl BlacklistInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input
            .split_first()
            .ok_or(ProgramError::InvalidInstructionData)?;

        match variant {
            0 => {
                let payload = InitializeAdminPayload::try_from_slice(rest)
                    .map_err(|_| ProgramError::InvalidInstructionData)?;

                Ok(BlacklistInstruction::InitializeAdmin {
                    admin: payload.admin,
                })
            }
            1 => {
                let payload = UpdateAdminPayload::try_from_slice(rest)
                    .map_err(|_| ProgramError::InvalidInstructionData)?;

                Ok(BlacklistInstruction::UpdateAdmin {
                    new_admin: payload.new_admin,
                })
            }
            2 => {
                let payload = AddToBlacklistPayload::try_from_slice(rest)
                    .map_err(|_| ProgramError::InvalidInstructionData)?;

                Ok(BlacklistInstruction::AddToBlacklist {
                    address: payload.address,
                })
            }
            3 => {
                let payload = RemoveFromBlacklistPayload::try_from_slice(rest)
                    .map_err(|_| ProgramError::InvalidInstructionData)?;

                Ok(BlacklistInstruction::RemoveFromBlacklist {
                    address: payload.address,
                })
            }
            _ => Err(ProgramError::InvalidInstructionData),
        }
    }
}
