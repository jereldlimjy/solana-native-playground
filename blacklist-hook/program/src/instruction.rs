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
            _ => Err(ProgramError::InvalidInstructionData),
        }
    }
}
