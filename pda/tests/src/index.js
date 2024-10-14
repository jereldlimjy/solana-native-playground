import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { getKeypairFromFile } from "@solana-developers/helpers";
import * as borsh from "@coral-xyz/borsh";

const main = async () => {
  const programId = new PublicKey(
    "CJ3JZMLDSTec2RzadcDNyHJ8wQLrn7nS5FtPXPQ8oJw4"
  );
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");

  const keyPair = await getKeypairFromFile("~/.config/solana/id.json");

  const blockhashInfo = await connection.getLatestBlockhash();

  const txn = new Transaction({
    ...blockhashInfo,
  });

  const addMovieReviewSchema = borsh.struct([
    borsh.u8("variant"),
    borsh.str("title"),
    borsh.u8("rating"),
    borsh.str("description"),
  ]);

  const buffer = Buffer.alloc(1000);

  addMovieReviewSchema.encode(
    {
      variant: 0,
      title: "Inception",
      rating: "10",
      description: "Awesome movie by Christopher Nolan",
    },
    buffer
  );

  const instructionBuffer = buffer.subarray(
    0,
    addMovieReviewSchema.getSpan(buffer)
  );

  // seeds - sender address + movie title
  const seeds = [keyPair.publicKey.toBuffer(), Buffer.from("Inception")];

  const [pda, _] = PublicKey.findProgramAddressSync(seeds, programId);

  console.log("PDA is:", pda.toBase58());

  txn.add(
    new TransactionInstruction({
      programId,
      keys: [
        {
          pubkey: keyPair.publicKey,
          isSigner: true,
          isWritable: true,
        },
        {
          pubkey: pda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      data: instructionBuffer,
    })
  );

  // alternative way
  // txn.sign(keyPair);
  // const txHash = await connection.sendRawTransaction(txn.serialize());

  const txHash = await sendAndConfirmTransaction(connection, txn, [keyPair]);
  console.log(
    `Congratulations! Look at your transaction in the Solana Explorer:
    https://explorer.solana.com/tx/${txHash}?cluster=custom`
  );
};

main().catch((err) => {
  console.error(err);
});
