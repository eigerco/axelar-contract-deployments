# Offline Transaction Workflow

This file contains the complete workflow for offline transaction signing, required for all mainnet operations. The offline workflow ensures secure signing using hardware wallets in air-gapped environments.

## Prerequisites

Make sure you have:
- Hardware wallet (Ledger) for mainnet signing
- Offline signing environment prepared
- Account nonce and gas parameters
- For multisig: Coordination with other signers

## Workflow Overview

The offline transaction workflow consists of seven steps:

1. **Gas Estimation** (Online) - Estimate transaction fees using an online environment
2. **Transaction Generation** (Offline) - Generate unsigned transaction with gas parameters
3. **Signature Distribution** - Share unsigned transaction with multisig signers
4. **Individual Signing** (Offline) - Each signer signs independently
5. **Signature Collection** - Collect all signed files
6. **Signature Combination** - Combine signatures for multisig
7. **Transaction Broadcast** (Online) - Submit to network

## Environment Setup

```bash
# For gas estimation (online)
export STARKNET_ENV=mainnet
export STARKNET_PRIVATE_KEY=0x...
export STARKNET_ACCOUNT_ADDRESS=0x...

# For offline signing
# No network access required
# Ledger must be connected
```

## Complete Workflow Steps

### Step 1: Gas Estimation (Online)

Estimate gas parameters for your transaction:

```bash
# Example: Deploy contract
npx ts-node starknet/deploy-contract.ts \
  --env mainnet \
  --contractConfigName AxelarGateway \
  --constructorCalldata '["0x1234"]' \
  --salt 0x123 \
  --estimate \
  --privateKey 0x... \
  --accountAddress 0x...

# Example: Gateway call
npx ts-node gateway.ts call-contract \
  "ethereum" \
  "0x1234567890123456789012345678901234567890" \
  "Hello from Starknet" \
  --env mainnet \
  --estimate \
  --privateKey 0x... \
  --accountAddress 0x...
```

Output shows CLI arguments to copy:
```
--l1GasMaxAmount 50000 --l1GasMaxPricePerUnit 100000000000 --l2GasMaxAmount 1000000 --l2GasMaxPricePerUnit 1000000000
```

### Step 2: Generate Unsigned Transaction (Offline)

Transfer gas parameters to offline environment and generate unsigned transaction:

```bash
# Example: Deploy contract
npx ts-node starknet/deploy-contract.ts \
  --env mainnet \
  --contractConfigName AxelarGateway \
  --constructorCalldata '["0x1234"]' \
  --salt 0x123 \
  --offline \
  --nonce 5 \
  --accountAddress 0x... \
  --l1GasMaxAmount 50000 \
  --l1GasMaxPricePerUnit 100000000000 \
  --l2GasMaxAmount 1000000 \
  --l2GasMaxPricePerUnit 1000000000
```

Creates file: `starknet-offline-txs/deploy_AxelarGateway_starknet_2025-06-12T10-30-45-123Z.json`

### Step 3: Sign with Ledger (Offline)

Each signer signs the transaction independently:

```bash
# Install dependencies if needed
npm install @ledgerhq/hw-transport-node-hid @ledgerhq/hw-app-starknet

# Sign transaction
npx ts-node starknet/sign-transaction.ts \
  starknet-offline-txs/deploy_AxelarGateway_starknet_2025-06-12T10-30-45-123Z.json \
  --ledger-path "m/44'/9004'/0'/0/0" \
  --env mainnet
```

Creates signed file: `*_signed.json`

### Step 4: Combine Signatures (Multisig Only)

Coordinator combines all signatures:

```bash
# Default output filename
npx ts-node starknet/combine-signatures.ts \
  starknet-offline-txs/deploy_AxelarGateway_starknet_2025-06-12T10-30-45-123Z_signed.json \
  starknet-offline-txs/deploy_AxelarGateway_starknet_another_signer_signed.json

# Custom output filename
npx ts-node starknet/combine-signatures.ts \
  signer1_signed.json \
  signer2_signed.json \
  -o custom_multisig.json
```

Creates combined file: `tx_multisig_signed_*.json`

### Step 5: Broadcast Transaction (Online)

Transfer signed transaction to online environment and broadcast:

```bash
# Single signature
npx ts-node starknet/broadcast-transaction.ts \
  starknet-offline-txs/deploy_AxelarGateway_starknet_2025-06-12T10-30-45-123Z_signed.json \
  --env mainnet \
  --contract-config-name AxelarGateway

# Multisig
npx ts-node starknet/broadcast-transaction.ts \
  starknet-offline-txs/tx_multisig_signed_2025-06-12T10-35-22-789Z.json \
  --env mainnet \
  --contract-config-name AxelarGateway
```

## Command Options

### Gas Estimation Options
- `--estimate`: Calculate gas parameters
- `--privateKey`: Private key for estimation
- `--accountAddress`: Account address

### Offline Transaction Options
- `--offline`: Generate unsigned transaction
- `--nonce`: Account nonce (required)
- `--accountAddress`: Transaction sender
- `--l1GasMaxAmount`: L1 gas amount
- `--l1GasMaxPricePerUnit`: L1 gas price
- `--l2GasMaxAmount`: L2 gas amount
- `--l2GasMaxPricePerUnit`: L2 gas price
- `--l1DataMaxAmount`: L1 data amount (optional)
- `--l1DataMaxPricePerUnit`: L1 data price (optional)

### Signing Options
- `--ledger-path`: Derivation path (default: "m/44'/9004'/0'/0/0")
- `--env`: Environment (mainnet/testnet)

### Broadcast Options
- `--env`: Target environment
- `--contract-config-name`: Contract name for config update

## File Management

### Generated Files
- **Unsigned**: `starknet-offline-txs/{operation}_{contract}_{network}_{timestamp}.json`
- **Signed**: `{original_filename}_signed.json`
- **Multisig**: `tx_multisig_signed_{timestamp}.json`

### File Structure
```json
{
  "transaction": {
    "calls": [...],
    "sender_address": "0x...",
    "max_fee": "0x...",
    "signature": [...],
    "nonce": "0x...",
    "version": "0x..."
  },
  "metadata": {
    "timestamp": "...",
    "operation": "...",
    "network": "..."
  }
}
```

## Security Considerations

### Offline Environment
- Disconnect from network before signing
- Verify transaction details on Ledger screen
- Never expose private keys
- Use dedicated offline machine

### File Transfer
- Use secure USB drives
- Verify file integrity
- Delete sensitive files after use
- Keep audit trail

### Multisig Coordination
- Verify all signers independently
- Use secure communication channels
- Confirm transaction details match
- Track signature collection

## Common Issues

**"Invalid nonce"**
- Solution: Get current nonce from blockchain

**"Ledger not found"**
- Solution: Ensure Ledger connected and unlocked

**"Insufficient gas"**
- Solution: Re-estimate with higher multiplier

**"Signature mismatch"**
- Solution: Verify all signers used same transaction

## Workflow Examples

### Example 1: Deploy Contract (Single Signer)

```bash
# 1. Estimate gas (online)
npx ts-node starknet/deploy-contract.ts \
  --env mainnet \
  --contractConfigName MyContract \
  --estimate \
  --privateKey $KEY \
  --accountAddress $ADDR

# 2. Generate unsigned (offline)
npx ts-node starknet/deploy-contract.ts \
  --env mainnet \
  --contractConfigName MyContract \
  --offline \
  --nonce 10 \
  --accountAddress $ADDR \
  --l1GasMaxAmount 50000 \
  --l1GasMaxPricePerUnit 100000000000

# 3. Sign with Ledger (offline)
npx ts-node starknet/sign-transaction.ts \
  starknet-offline-txs/deploy_MyContract_mainnet_*.json \
  --ledger-path "m/44'/9004'/0'/0/0"

# 4. Broadcast (online)
npx ts-node starknet/broadcast-transaction.ts \
  starknet-offline-txs/deploy_MyContract_mainnet_*_signed.json \
  --env mainnet
```

### Example 2: Multisig Operation

```bash
# 1-2. Same as single signer

# 3. Each signer signs independently
# Signer 1:
npx ts-node starknet/sign-transaction.ts tx.json --ledger-path "m/44'/9004'/0'/0/0"

# Signer 2:
npx ts-node starknet/sign-transaction.ts tx.json --ledger-path "m/44'/9004'/0'/0/1"

# 4. Combine signatures
npx ts-node starknet/combine-signatures.ts \
  tx_signer1_signed.json \
  tx_signer2_signed.json

# 5. Broadcast
npx ts-node starknet/broadcast-transaction.ts \
  tx_multisig_signed_*.json \
  --env mainnet
```

## Notes

- Always test workflow on testnet first
- Keep transaction files secure
- Verify gas parameters before signing
- Monitor transaction after broadcast
- Update config after successful deployment

