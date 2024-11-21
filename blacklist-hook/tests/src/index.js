import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  TransactionInstruction,
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
import {} from "@solana/spl-token-metadata";
import * as borsh from "@coral-xyz/borsh";

const main = async () => {
  const transferHookProgramId = new PublicKey(
    "2vo6T4ncvhhWw7S73QfZznR141gHLT2KsDJjLB75NhqL"
  );
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const keyPair = await getKeypairFromFile("~/.config/solana/id.json");

  // Admin PDA tests
  const blockhashInfo = await connection.getLatestBlockhash();

  // // initialize admin instruction
  const initializeTxn = new Transaction({
    ...blockhashInfo,
  });

  const initializeAdminSchema = borsh.struct([
    borsh.u8("variant"),
    borsh.publicKey("admin"),
  ]);

  const buffer = Buffer.alloc(1000);

  initializeAdminSchema.encode(
    {
      variant: 0,
      admin: keyPair.publicKey,
    },
    buffer
  );

  const instructionBuffer = buffer.subarray(
    0,
    initializeAdminSchema.getSpan(buffer)
  );

  // seeds - sender address + movie title
  const seeds = [Buffer.from("admin")];

  const [pda, _] = PublicKey.findProgramAddressSync(
    seeds,
    transferHookProgramId
  );

  console.log("PDA is:", pda.toBase58());

  initializeTxn.add(
    new TransactionInstruction({
      programId: transferHookProgramId,
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

  const initializeTxHash = await sendAndConfirmTransaction(
    connection,
    initializeTxn,
    [keyPair]
  );
  console.log(
    `Congratulations! Look at your transaction in the Solana Explorer:
    https://explorer.solana.com/tx/${initializeTxHash}?cluster=custom`
  );

  // update admin instruction
  // const updateTxn = new Transaction({
  //   ...(await connection.getLatestBlockhash()),
  // });

  // const updateAdminSchema = borsh.struct([
  //   borsh.u8("variant"),
  //   borsh.publicKey("new_admin"),
  // ]);

  // const buffer2 = Buffer.alloc(1000);
  // const newKeyPair = new Keypair();

  // updateAdminSchema.encode(
  //   {
  //     variant: 1,
  //     new_admin: newKeyPair.publicKey,
  //   },
  //   buffer2
  // );

  // const instructionBuffer2 = buffer2.subarray(
  //   0,
  //   updateAdminSchema.getSpan(buffer2)
  // );

  // updateTxn.add(
  //   new TransactionInstruction({
  //     programId: transferHookProgramId,
  //     keys: [
  //       {
  //         pubkey: keyPair.publicKey,
  //         isSigner: true,
  //         isWritable: true,
  //       },
  //       {
  //         pubkey: pda,
  //         isSigner: false,
  //         isWritable: true,
  //       },
  //     ],
  //     data: instructionBuffer2,
  //   })
  // );

  // const updateTxHash = await sendAndConfirmTransaction(connection, updateTxn, [
  //   keyPair,
  // ]);
  // console.log(
  //   `Congratulations! Look at your transaction in the Solana Explorer:
  //   https://explorer.solana.com/tx/${updateTxHash}?cluster=custom`
  // );

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
      mint.publicKey,
      keyPair.publicKey,
      transferHookProgramId,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMintInstruction(
      mint.publicKey,
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

  // Test blacklist instructions
  // test adding address to blacklist
  const addToBlacklistTxn = new Transaction({
    ...blockhashInfo,
  });

  const blacklistSchema = borsh.struct([
    borsh.u8("variant"),
    borsh.publicKey("address"),
  ]);

  const addToBlacklistBuffer = Buffer.alloc(1000);

  const blacklistKeypair = new Keypair();

  blacklistSchema.encode(
    {
      variant: 2,
      address: blacklistKeypair.publicKey,
    },
    addToBlacklistBuffer
  );

  const addToBlacklistInstructionBuffer = addToBlacklistBuffer.subarray(
    0,
    blacklistSchema.getSpan(addToBlacklistBuffer)
  );

  // admin seeds - "admin" string
  const adminSeeds = [Buffer.from("admin")];

  const [adminPda] = PublicKey.findProgramAddressSync(
    adminSeeds,
    transferHookProgramId
  );

  // blacklist seeds - "blacklist" string + address
  const blacklistSeeds = [
    Buffer.from("blacklist"),
    blacklistKeypair.publicKey.toBuffer(),
  ];

  const [blacklistPda] = PublicKey.findProgramAddressSync(
    blacklistSeeds,
    transferHookProgramId
  );

  addToBlacklistTxn.add(
    new TransactionInstruction({
      programId: transferHookProgramId,
      keys: [
        {
          pubkey: keyPair.publicKey,
          isSigner: true,
          isWritable: true,
        },
        {
          pubkey: adminPda,
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: blacklistPda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      data: addToBlacklistInstructionBuffer,
    })
  );

  const addToBlacklistHash = await sendAndConfirmTransaction(
    connection,
    addToBlacklistTxn,
    [keyPair]
  );
  console.log(
    `Congratulations! Look at your add to blacklist transaction in the Solana Explorer:
    https://explorer.solana.com/tx/${addToBlacklistHash}?cluster=custom`
  );

  // test removing address from blacklist
  const removeFromBlacklistBuffer = Buffer.alloc(1000);

  blacklistSchema.encode(
    {
      variant: 3,
      address: blacklistKeypair.publicKey,
    },
    removeFromBlacklistBuffer
  );

  const removeFromBlacklistInstructionBuffer =
    removeFromBlacklistBuffer.subarray(
      0,
      blacklistSchema.getSpan(removeFromBlacklistBuffer)
    );

  const removeFromBlacklistTxn = new Transaction({
    ...blockhashInfo,
  });

  removeFromBlacklistTxn.add(
    new TransactionInstruction({
      programId: transferHookProgramId,
      keys: [
        {
          pubkey: keyPair.publicKey,
          isSigner: true,
          isWritable: true,
        },
        {
          pubkey: adminPda,
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: blacklistPda,
          isSigner: false,
          isWritable: true,
        },
      ],
      data: removeFromBlacklistInstructionBuffer,
    })
  );

  const removeFromBlacklistHash = await sendAndConfirmTransaction(
    connection,
    removeFromBlacklistTxn,
    [keyPair]
  );
  console.log(
    `Congratulations! Look at your remove from blacklist transaction in the Solana Explorer:
    https://explorer.solana.com/tx/${removeFromBlacklistHash}?cluster=custom`
  );

  // test non-admin add/remove
  const addToBlacklistNonAdminTxn = new Transaction({
    ...blockhashInfo,
  });

  const addToBlacklistNonAdminBuffer = Buffer.alloc(1000);

  const nonAdminKeypair = new Keypair();
  console.log(
    "non admin keypair address:",
    nonAdminKeypair.publicKey.toBase58()
  );

  // airdrop to non admin account
  const airdropTx = await connection.requestAirdrop(
    nonAdminKeypair.publicKey,
    100 * LAMPORTS_PER_SOL
  );

  await connection.confirmTransaction({
    blockhash: blockhashInfo.blockhash,
    lastValidBlockHeight: blockhashInfo.lastValidBlockHeight,
    signature: airdropTx,
  });

  blacklistSchema.encode(
    {
      variant: 2,
      address: blacklistKeypair.publicKey,
    },
    addToBlacklistNonAdminBuffer
  );

  const addToBlacklistNonAdminInstructionBuffer =
    addToBlacklistNonAdminBuffer.subarray(
      0,
      blacklistSchema.getSpan(addToBlacklistNonAdminBuffer)
    );

  addToBlacklistNonAdminTxn.add(
    new TransactionInstruction({
      programId: transferHookProgramId,
      keys: [
        {
          pubkey: nonAdminKeypair.publicKey,
          isSigner: true,
          isWritable: true,
        },
        {
          pubkey: adminPda,
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: blacklistPda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      data: addToBlacklistNonAdminInstructionBuffer,
    })
  );

  // should fail
  try {
    const addToBlacklistNonAdminHash = await sendAndConfirmTransaction(
      connection,
      addToBlacklistNonAdminTxn,
      [nonAdminKeypair]
    );
  } catch (err) {
    console.log("adding to blacklist using non-admin account failed");
  }

  // transfer tokens from default keypair -> newly generated keypair
  // create extraAccountMetaList account
  // transfer instruction with transfer hook

  // TODO: create extraAccountMetaList account
  // const [extraAccountMetaListPDA] = PublicKey.findProgramAddressSync(
  //   [Buffer.from("extra-account-metas"), mint.publicKey.toBuffer()],
  //   transferHookProgramId
  // );

  // const txn3 = new Transaction().add(
  //   await createTransferCheckedWithTransferHookInstruction(
  //     connection,
  //     senderTokenAccount,
  //     mint.publicKey,
  //     receiverTokenAccount,
  //     keyPair.publicKey,
  //     10 * 10 ** decimals,
  //     [],
  //     "confirmed",
  //     TOKEN_2022_PROGRAM_ID
  //   )
  // );

  // const txn3Hash = await sendAndConfirmTransaction(connection, txn3, [keyPair]);
  // console.log(
  //   `Congratulations! Look at your transaction in the Solana Explorer:
  //   https://explorer.solana.com/tx/${txn3Hash}?cluster=custom`
  // );
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
