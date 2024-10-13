import {
  Connection,
  Transaction,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { getKeypairFromFile } from "@solana-developers/helpers";
import * as borsh from "@coral-xyz/borsh";

const main = async () => {
  const programId = new PublicKey(
    "xtF5kvQSKCRzL1fLyQufseGHnzSHajitZVTy93bZ6DQ"
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
      title: "Spongebob Squarepants Movie",
      rating: 10,
      description: "Bikini Bottom",
    },
    buffer
  );

  const instructionBuffer = buffer.subarray(
    0,
    addMovieReviewSchema.getSpan(buffer)
  );

  txn.add(
    new TransactionInstruction({
      programId,
      keys: [],
      data: instructionBuffer,
    })
  );

  txn.sign(keyPair);

  const txHash = await connection.sendRawTransaction(txn.serialize());

  await connection.confirmTransaction({
    blockhash: blockhashInfo.blockhash,
    lastValidBlockHeight: blockhashInfo.lastValidBlockHeight,
    signature: txHash,
  });

  console.log(
    `Congratulations! Look at your transaction in the Solana Explorer:
    https://explorer.solana.com/tx/${txHash}?cluster=custom`
  );
};

main().catch((err) => {
  console.error(err);
});
