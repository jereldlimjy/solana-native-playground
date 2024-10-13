use borsh::BorshDeserialize;
use solana_program::program_error::ProgramError;

pub enum MovieInstruction {
    AddMovieReview {
        title: String,
        rating: u8,
        description: String,
    },
}

#[derive(BorshDeserialize)]
struct AddMovieReviewPayload {
    title: String,
    rating: u8,
    description: String,
}

impl MovieInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input
            .split_first()
            .ok_or(ProgramError::InvalidInstructionData)?;
        let payload = AddMovieReviewPayload::try_from_slice(rest)
            .map_err(|_| ProgramError::InvalidInstructionData)?;

        match variant {
            0 => Ok(MovieInstruction::AddMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description,
            }),
            _ => Err(ProgramError::InvalidInstructionData),
        }
    }
}
