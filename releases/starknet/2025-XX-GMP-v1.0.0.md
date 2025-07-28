# Starknet GMP v1.0.0

|                | **Owner**                                 |
| -------------- | ----------------------------------------- |
| **Created By** | @eigerco                                  |
| **Deployment** | @eigerco                                  |

| **Network**          | **Deployment Status** | **Date**   |
| -------------------- | --------------------- | ---------- |
| **Devnet Amplifier** | Pending               | TBD        |
| **Stagenet**         | Pending               | TBD        |
| **Testnet**          | Pending               | TBD        |
| **Mainnet**          | Pending               | TBD        |

- [GitHub Repository](https://github.com/eigerco/giza-axelar-starknet)
- [Releases](https://github.com/eigerco/giza-axelar-starknet/releases)

## Background

Changes in the release:

This is the v1.0.0 initial GMP release for Starknet.

## Deployment

Create an `.env` config:

```yaml
# Change `STARKNET_PRIVATE_KEY` in `.env` to Starknet private key
STARKNET_PRIVATE_KEY=<starknet_deployer_key>
STARKNET_ACCOUNT_ADDRESS=<starknet_account_address>
ENV=<devnet-amplifier|stagenet|testnet|mainnet>
CHAIN=starknet-dev
```

An initial Starknet chain config needs to be added to `${ENV}.json` file under `chains` key.

#### Devnet-Amplifier / Stagenet / Testnet

```json
"starknet-dev": {
  "name": "Starknet-Sepolia",
  "axelarId": "starknet-dev",
  "rpc": "https://starknet-sepolia.public.blastapi.io/rpc/v0_8",
  "tokenSymbol": "STRK",
  "decimals": 18,
  "universalDeployerAddress": "0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf",
  "contracts": {},
  "explorer": {
    "explorer": "Voyager",
    "url": "https://sepolia.voyager.online"
  },
  "gasOptions": {
    "gasLimit": 8000000
  },
  "approxFinalityWaitTime": 3
}
```

#### Mainnet

```json
"starknet": {
  "name": "Starknet",
  "axelarId": "starknet",
  "rpc": "[TBD]",
  "tokenSymbol": "STRK", 
  "decimals": 18,
  "universalDeployerAddress": "TBD",
  "contracts": {},
  "explorer": {
    "explorer": "Voyager",
    "url": "https://voyager.online"
  },
  "gasOptions": {
    "gasLimit": 8000000
  },
  "approxFinalityWaitTime": 3
}
```

1. Request Tokens from Faucet

For testnet deployments, request STRK tokens from the Starknet faucet:
- <https://starknet-faucet.vercel.app/>

2. Addresses needed for deploying various contracts
Verify deployer address

| Network              | `deployer address`                                                    |
| -------------------- | --------------------------------------------------------------------- |
| **Devnet-amplifier** | `0x03D268008DcA0F241d2cF93578e1428dB0E94bdE3db22C93bCa93873Bc72851e` |
| **Stagenet**         | `0x06D6e00Cb26C024e040136ab7F31B9AD15Ae2aA3Fd42544A7eCa6D2A9ce43b71` |
| **Testnet**          | `0x06E83538F668A056D4568c5387B6865084017080fae9966978131fA4BBe8BE36` |
| **Mainnet**          | `TBD`                                                                 |

Verify operator address

| Network              | `operator address`                                                    |
| -------------------- | --------------------------------------------------------------------- |
| **Devnet-amplifier** | `TBD` |
| **Stagenet**         | `TBD`                                                                 |
| **Testnet**          | `TBD`                                                                 |
| **Mainnet**          | `TBD`                                                                 |

Verify owner address

| Network              | `owner address`                                                       |
| -------------------- | --------------------------------------------------------------------- |
| **Devnet-amplifier** | `TBD` |
| **Stagenet**         | `TBD`                                                                 |
| **Testnet**          | `TBD`                                                                 |
| **Mainnet**          | `TBD`                                                                 |

Verify gas collector address

| Network              | `gas collector address`                                               |
| -------------------- | --------------------------------------------------------------------- |
| **Devnet-amplifier** | `TBD` |
| **Stagenet**         | `TBD`                                                                 |
| **Testnet**          | `TBD`                                                                 |
| **Mainnet**          | `TBD`                                                                 |

3. Build and Declare Contracts

Before deploying any contracts, you need to build and declare them on-chain. For detailed instructions on contract declaration, see the [Contract Declaration documentation](../../starknet/docs/declare.md).

```bash
# Build all contracts
cd /path/to/giza-axelar-starknet
scarb build

# Declare Gateway contract
npx ts-node starknet/declare-contract.ts \
  --contractConfigName AxelarGateway \
  --contractPath /path/to/giza-axelar-starknet/target/dev/gateway_AxelarGateway.contract_class.json \
  --env $ENV \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS

# Declare Operators contract
npx ts-node starknet/declare-contract.ts \
  --contractConfigName Operators \
  --contractPath /path/to/giza-axelar-starknet/target/dev/operators_Operators.contract_class.json \
  --env $ENV \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS

# Declare Gas Service contract
npx ts-node starknet/declare-contract.ts \
  --contractConfigName AxelarGasService \
  --contractPath /path/to/giza-axelar-starknet/target/dev/gas_service_AxelarGasService.contract_class.json \
  --env $ENV \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS
```

**Note:** Contract declaration is required before deployment and saves the class hash to the config file for later use.

4. Deploy Gateway

| Network              | `minimumRotationDelay` | `previousSignersRetention` |
| -------------------- | ---------------------- | -------------------------- |
| **Devnet-amplifier** | `0`                    | `15`                       |
| **Stagenet**         | `300`                  | `15`                       |
| **Testnet**          | `3600`                 | `15`                       |
| **Mainnet**          | `86400`                | `15`                       |

Deploy the Gateway:

```bash
npx ts-node starknet/deploy-amplifier-gateway.ts \
  --env $ENV \
  --contractConfigName AxelarGateway \
  --minimumRotationDelay [minimum-rotation-delay] \
  --previousSignersRetention 15 \
  --domainSeparator offline \
  --owner $STARKNET_ACCOUNT_ADDRESS \
  --operator $STARKNET_ACCOUNT_ADDRESS \
  --salt 0 \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS
```

5. Deploy Operators

```bash
npx ts-node starknet/operators.ts deploy \
  --env $ENV \
  --owner $STARKNET_ACCOUNT_ADDRESS \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS
```

5. Deploy Gas Service

```bash
npx ts-node starknet/gas-service.ts deploy \
  --env $ENV \
  --gasCollector $STARKNET_ACCOUNT_ADDRESS \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS
```

6. After deploying Starknet contracts, ensure that you deploy [Starknet GMP Amplifier](../cosmwasm/YYYY-MM-Starknet-GMP.md).

7. Rotate genesis verifier set on Starknet Gateway

```bash
npx ts-node starknet/gateway.ts init-signers '[{"signers": [{"signer": "[signer-address]", "weight": 1}], "threshold": 1, "nonce": "0x1"}]' \
  --env $ENV \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS
```

8. Get the list of operators used by the relayer and register on the Operators contract.

```bash
npx ts-node starknet/operators.ts add-operator [operator-address] \
  --env $ENV \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS
```

## Checklist

The following checks should be performed after the rollout

### Verify Starknet → EVM GMP call

1. Send a GMP call

```bash
npx ts-node starknet/gateway.ts call-contract [destination-chain] [destination-contract-address] [payload] --env $ENV --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS
```

2. Route GMP call via Amplifier

- <https://docs.axelar.dev/dev/amplifier/chain-integration/relay-messages>

3. Submit proof with multisig session id

```bash
# Change `PRIVATE_KEY` in `.env` to EVM
PRIVATE_KEY=<evm_deployer_key>

ts-node evm/gateway.js -n [destination-chain] --action submitProof --multisigSessionId [multisig-session-id]
```

4. Confirm whether the message is approved

```bash
ts-node evm/gateway.js -n [destination-chain] --action isContractCallApproved --commandID [command-id] --sourceChain $CHAIN --sourceAddress [source-address] --destination [destination-address] --payloadHash [payload-hash]
```

### Verify EVM → Starknet GMP Call

1. Send a GMP call

```bash
ts-node evm/gateway.js -n [source-chain] --action callContract --destinationChain $CHAIN --destination [destination-address] --payload 0x1234
```

2. Route GMP call via Amplifier

- <https://docs.axelar.dev/dev/amplifier/chain-integration/relay-messages>

3. Submit proof with multisig session id

```bash
# Change `STARKNET_PRIVATE_KEY` in `.env` to Starknet
STARKNET_PRIVATE_KEY=<starknet_deployer_key>
STARKNET_ACCOUNT_ADDRESS=<starknet_account_address>

npx ts-node starknet/gateway.ts approve-messages '[{"source_chain": "[source-chain]", "message_id": "[message-id]", "source_address": "[source-address]", "contract_address": "[destination-address]", "payload_hash": "[payload-hash]"}]' '{"signers": {"signers": [{"signer": "[signer1]", "weight": 1}], "threshold": 1, "nonce": "[nonce]"}, "signatures": [[signature-bytes]]}' --env $ENV --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS
```

4. Call validate to confirm message

```bash
npx ts-node starknet/gateway.ts validate-message [source-chain] [message-id] [source-address] [payload-hash] --env $ENV --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS
```
