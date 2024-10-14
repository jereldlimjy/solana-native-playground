# solana-native-playground

Solana programs written in native Rust

## Prerequisites

Ensure you have the following installed on your machine:

- [Solana CLI](https://solana.com/docs/intro/installation)
- [Node.js](https://nodejs.org/)
- [Rust](https://rustup.rs/)

## Setup Instructions

### 1. Start Solana Test Validator

All the programs in this repo use the test validator by default.

Before deploying and testing, make sure to start the Solana test validator:

```bash
solana-test-validator
```

### 2. Build and Deploy the Program

Ensure the `cicd.sh` script has execution permissions. If needed, run:

```bash
chmod +x cicd.sh
```

Then, run the script to build and deploy the program to the test validator:

```bash
./cicd.sh
```

### 3. Run Tests

To run the tests, navigate to the `tests` directory and execute:

```bash
cd tests
npm install
npm run test
```
