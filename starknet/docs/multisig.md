# Argent Multisig Operations

This file contains example commands for managing Argent multisig v0.2.0 accounts. These commands allow you to control signers, thresholds, and guardian recovery features.

## Prerequisites

Make sure you have:
- A deployed Argent v0.2.0 multisig account
- Valid signer credentials
- For mainnet: Ledger hardware wallet
- Understanding of multisig threshold requirements

## Environment Vars

If you prefer using env vars, instead of --env --privateKey and --accountAddress you can use the following env vars:

```bash
# For gas estimation (online)
export STARKNET_ENV=testnet
export STARKNET_PRIVATE_KEY=0x...
export STARKNET_ACCOUNT_ADDRESS=0x...

# For offline signing
# No network access required
# Ledger must be connected
```

## Get Ledger Public Key

Retrieve your Ledger's public key for use as a multisig signer (Ledger must be connected and app opened):

```bash
npx ts-node starknet/multisig.ts get-ledger-pubkey \
  --ledger-path "m/44'/9004'/0'/0/0"
```

## Read Operations

### Get Threshold

```bash
npx ts-node starknet/multisig.ts get-threshold \
  --contract-address 0x... \
  --env testnet
```

### Get Signers

```bash
npx ts-node starknet/multisig.ts get-signers \
  --contract-address 0x... \
  --env testnet
```

### Check if Address is Signer

```bash
npx ts-node starknet/multisig.ts is-signer \
  --contract-address 0x... \
  --signers 0x... \
  --signer-type starknet \
  --env testnet
```

## Multisig Management Operations

All management operations support both online and offline modes with gas estimation.

### Change Threshold

**Online (Testnet):**
```bash
npx ts-node starknet/multisig.ts change-threshold \
  --contract-address 0x... \
  --threshold 2 \
  --env testnet \
  --privateKey 0x... \
  --accountAddress 0x...
```

**Offline (Mainnet):**
```bash
# Step 1: Estimate gas
npx ts-node starknet/multisig.ts change-threshold \
  --contract-address 0x... \
  --threshold 2 \
  --env mainnet \
  --estimate \
  --privateKey 0x... \
  --accountAddress 0x...

# Step 2: Generate unsigned transaction
npx ts-node starknet/multisig.ts change-threshold \
  --contract-address 0x... \
  --threshold 2 \
  --env mainnet \
  --offline \
  --nonce 5 \
  --accountAddress 0x... \
  --l1GasMaxAmount 50000 \
  --l1GasMaxPricePerUnit 100000000000
```

### Add Signers

```bash
npx ts-node starknet/multisig.ts add-signers \
  --contract-address 0x... \
  --threshold 2 \
  --signers 0x1234...,0x5678... \
  --signer-type starknet \
  --env testnet \
  --privateKey 0x... \
  --accountAddress 0x...
```

### Remove Signers

```bash
npx ts-node starknet/multisig.ts remove-signers \
  --contract-address 0x... \
  --threshold 1 \
  --signers 0x1234... \
  --signer-type starknet \
  --env testnet \
  --privateKey 0x... \
  --accountAddress 0x...
```

### Replace Signer

```bash
npx ts-node starknet/multisig.ts replace-signer \
  --contract-address 0x... \
  --signer-to-remove 0x1234... \
  --signer-to-add 0x5678... \
  --signer-type starknet \
  --env testnet \
  --privateKey 0x... \
  --accountAddress 0x...
```

## Guardian Recovery Operations

Manage guardian-based account recovery for emergency situations.

### Enable/Disable Guardian Recovery

```bash
npx ts-node starknet/multisig.ts toggle-escape \
  --contract-address 0x... \
  --is-enabled true \
  --security-period 86400 \
  --expiry-period 604800 \
  --guardian 0x... \
  --env testnet \
  --privateKey 0x... \
  --accountAddress 0x...
```

### Get Guardian

```bash
npx ts-node starknet/multisig.ts get-guardian \
  --contract-address 0x... \
  --env testnet
```

### Trigger Escape (Guardian Only)

```bash
npx ts-node starknet/multisig.ts trigger-escape \
  --contract-address 0x... \
  --selector 0x... \
  --calldata 0x1234,0x5678 \
  --env testnet \
  --privateKey 0x... \
  --accountAddress 0x...
```

### Execute Escape (After Security Period)

```bash
npx ts-node starknet/multisig.ts execute-escape \
  --contract-address 0x... \
  --selector 0x... \
  --calldata 0x1234,0x5678 \
  --env testnet \
  --privateKey 0x... \
  --accountAddress 0x...
```

### Cancel Escape

```bash
npx ts-node starknet/multisig.ts cancel-escape \
  --contract-address 0x... \
  --env testnet \
  --privateKey 0x... \
  --accountAddress 0x...
```

### Get Escape Status

```bash
npx ts-node starknet/multisig.ts get-escape \
  --contract-address 0x... \
  --env testnet
```

## Supported Signer Types

- `starknet`: Standard Starknet signers (default)
- `secp256k1`: Ethereum-compatible signers
- `secp256r1`: P-256 curve signers
- `eip191`: EIP-191 compliant signers

## Multisig Workflow Example

### 1. Check Current State

```bash
npx ts-node starknet/multisig.ts get-threshold --contract-address 0x... --env testnet
npx ts-node starknet/multisig.ts get-signers --contract-address 0x... --env testnet
```

### 2. Generate Offline Transaction (Mainnet)

```bash
# Estimate gas first
npx ts-node starknet/multisig.ts add-signers \
  --contract-address 0x... \
  --threshold 2 \
  --signers 0xNewSigner \
  --estimate \
  --env mainnet \
  --privateKey 0x... \
  --accountAddress 0x...

# Generate unsigned transaction
npx ts-node starknet/multisig.ts add-signers \
  --contract-address 0x... \
  --threshold 2 \
  --signers 0xNewSigner \
  --offline \
  --nonce 5 \
  --accountAddress 0x... \
  --l1GasMaxAmount 50000 \
  --l1GasMaxPricePerUnit 100000000000
```

### 3. Sign and Broadcast

Follow the standard offline workflow for signing and broadcasting (see main README).

## Command Options

### Common Options
- `--contract-address`: The multisig contract address
- `--env`: Environment (testnet, mainnet)
- `--privateKey`: Private key (for online operations)
- `--accountAddress`: Account address for transaction

### Signer Management Options
- `--threshold`: Required number of signatures
- `--signers`: Comma-separated list of signer addresses
- `--signer-type`: Type of signer (starknet, secp256k1, etc.)
- `--signer-to-remove`: Address to remove (replace operation)
- `--signer-to-add`: Address to add (replace operation)

### Guardian Options
- `--is-enabled`: Enable/disable guardian recovery
- `--security-period`: Time delay before escape execution (seconds)
- `--expiry-period`: Time window for escape execution (seconds)
- `--guardian`: Guardian address
- `--selector`: Function selector for escape
- `--calldata`: Comma-separated calldata for escape

### Offline Options
- `--offline`: Generate unsigned transaction
- `--estimate`: Estimate gas fees
- `--nonce`: Account nonce
- Gas parameters (see main README)

## Debugging Tools

### Debug Signer Registration

```bash
npx ts-node starknet/debug-multisig-signer.ts \
  YOUR_MULTISIG_ADDRESS \
  YOUR_PUBLIC_KEY \
  --env testnet
```

### Format Constructor for Deployment

```bash
npx ts-node starknet/format-multisig-constructor.ts \
  1 \
  0x1234...pubkey1 \
  0x5678...pubkey2
```

## Important Notes

### Threshold Requirements
- Threshold must be <= number of signers
- Removing signers may require threshold adjustment
- Cannot set threshold to 0

### Guardian Recovery
- Guardian can trigger emergency recovery
- Security period prevents immediate execution
- Expiry period limits execution window
- Regular signers can cancel escape

### Signer Types
- Different curves supported for compatibility
- Most common: starknet (default)
- Verify signer type matches key generation

## Common Issues

**"Invalid threshold"**
- Solution: Ensure threshold <= number of signers

**"Signer already exists"**
- Solution: Cannot add duplicate signers

**"Unauthorized"**
- Solution: Ensure account is a current signer

**"Escape not ready"**
- Solution: Wait for security period to expire

## Security Considerations

- Always verify signer addresses before adding
- Use appropriate threshold for security level
- Guardian should be highly trusted entity
- Test all changes on testnet first
- For mainnet, use offline workflow with hardware wallets
