import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { getKeypairFromFile } from "@solana-developers/helpers";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createInitializeTransferHookInstruction,
  createMintToInstruction,
  createTransferCheckedWithTransferHookInstruction,
  ExtensionType,
  getAssociatedTokenAddressSync,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

const main = async () => {
  const transferHookProgramId = new PublicKey("");
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const keyPair = await getKeypairFromFile("~/.config/solana/id.json");

  // to create a mint with the transfer hook extension, we need to:
  // - create the mint account using the `createAccount` instruction on the SystemProgram
  // - initialize the transfer hook extension using `createInitializeTransferHookInstruction`
  // - initialize the mint using `createInitializeMintInstruction`
  const mint = new Keypair();
  const decimals = 9;
  const extensions = [ExtensionType.TransferHook];
  const mintLen = getMintLen(extensions);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  const txn1 = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: keyPair.publicKey,
      newAccountPubkey: mint.publicKey,
      lamports,
      space: mintLen,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeTransferHookInstruction(
      mint,
      keyPair.publicKey,
      transferHookProgramId,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMintInstruction(
      mint,
      decimals,
      keyPair.publicKey,
      null,
      TOKEN_2022_PROGRAM_ID
    )
  );

  const txn1Hash = await sendAndConfirmTransaction(connection, txn1, [
    keyPair,
    mint,
  ]);

  console.log(
    `Congratulations! Look at your transaction in the Solana Explorer:
    https://explorer.solana.com/tx/${txn1Hash}?cluster=custom`
  );

  // create token accounts for default keypair and a newly generated keypair
  // mint to token account for default keypair
  const senderTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    keyPair.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const receiver = new Keypair();
  const receiverTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    receiver.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const txn2 = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      keyPair.publicKey,
      senderTokenAccount,
      keyPair.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    ),
    createAssociatedTokenAccountInstruction(
      keyPair.publicKey,
      receiverTokenAccount,
      receiver.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    ),
    createMintToInstruction(
      mint.publicKey,
      senderTokenAccount,
      keyPair.publicKey,
      100 * 10 ** decimals, // 100 tokens
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );

  const txn2Hash = await sendAndConfirmTransaction(connection, txn2, [keyPair]);
  console.log(
    `Congratulations! Look at your transaction in the Solana Explorer:
    https://explorer.solana.com/tx/${txn2Hash}?cluster=custom`
  );

  // transfer tokens from default keypair -> newly generated keypair
  // create extraAccountMetaList account
  // transfer instruction with transfer hook

  // TODO: create extraAccountMetaList account
  const [extraAccountMetaListPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), mint.publicKey.toBuffer()],
    transferHookProgramId
  );

  const txn3 = new Transaction().add(
    await createTransferCheckedWithTransferHookInstruction(
      connection,
      senderTokenAccount,
      mint.publicKey,
      receiverTokenAccount,
      keyPair.publicKey,
      100 * 10 ** decimals,
      [],
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    )
  );

  const txn3Hash = await sendAndConfirmTransaction(connection, txn3, [keyPair]);
  console.log(
    `Congratulations! Look at your transaction in the Solana Explorer:
    https://explorer.solana.com/tx/${txn3Hash}?cluster=custom`
  );
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
