# Starknet ITS v1.0.0

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

This is the MVP Starknet ITS release.

## Deployment

Ensure that [Starknet GMP](../starknet/2025-XX-GMP-v1.0.0.md) is deployed first.

Create an `.env` config:

```yaml
# Change `STARKNET_PRIVATE_KEY` in `.env` to Starknet private key
STARKNET_PRIVATE_KEY=<starknet_deployer_key>
STARKNET_ACCOUNT_ADDRESS=<starknet_account_address>
ENV=<devnet-amplifier|stagenet|testnet|mainnet>
CHAIN=starknet-dev
```

1. Addresses needed for deploying various contracts

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

2. Deploy Interchain Token Service

Ensure that initialization parameters are correct in `$ENV.json` after deployment.

```bash
npx ts-node starknet/its/deploy-its.ts \
  --env $ENV \
  --gateway [gateway-address] \
  --gasService [gas-service-address] \
  --chainName $CHAIN \
  --itsHubChainName axelar \
  --itsHubContractAddress [its-hub-address] \
  --operator $STARKNET_ACCOUNT_ADDRESS \
  --owner $STARKNET_ACCOUNT_ADDRESS \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS
```

3. Deploy Interchain Token Factory

```bash
npx ts-node starknet/its/deploy-itf.ts \
  --env $ENV \
  --interchainTokenService [its-address] \
  --owner $STARKNET_ACCOUNT_ADDRESS \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS
```

4. Register Starknet ITS on ITS Hub

ITS hub contract configuration in `$ENV.json` must include the following attributes per chain:

```bash
"axelar": {
  "contracts": {
    ...
    "InterchainTokenService": {
      ...
      "$CHAIN": {
        "maxUintBits": 251,
        "maxDecimalsWhenTruncating": 255
      }
    }
    ...
  }
}
```

Please refer to `$DEPOSIT_VALUE` and `$RUN_AS_ACCOUNT` from [Starknet GMP Amplifier](../cosmwasm/YYYY-MM-Starknet-GMP.md).

- `--runAs $RUN_AS_ACCOUNT` is only required for devnet-amplifier. Do not use `--runAs` for stagenet, testnet, or mainnet.
- Add a community post for the mainnet proposal. i.e: <https://community.axelar.network/t/proposal-add-its-hub-to-mainnet/3227>

```bash
ts-node cosmwasm/submit-proposal.js \
    its-hub-register-chains $CHAIN \
    -t "Register $CHAIN on ITS Hub" \
    -d "Register $CHAIN on ITS Hub" \
    --deposit $DEPOSIT_VALUE \
    --runAs $RUN_AS_ACCOUNT
```

5. Setting up trusted chains on Starknet

```bash
# Add all trusted chains to Starknet ITS
npx ts-node starknet/its/its.ts set-trusted-chain --chainName [trusted-chain] --env $ENV --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS
```

6. Set Starknet as trusted chain on EVM ITS. Similarly, set Starknet as a trusted chain for every other non EVM ITS contract

```bash
# Change `PRIVATE_KEY` in `.env` to EVM
PRIVATE_KEY=<evm_deployer_key>

ts-node evm/its.js -n all --action setTrustedAddress --trustedChain $CHAIN --trustedAddress hub
```

## Checklist

The following checks should be performed after the rollout

```bash
ITS_HUB_ADDRESS=<its_hub_address>
```

### Execute Command

The GMP call needs to be routed via Amplifier before the `execute` call.

- <https://docs.axelar.dev/dev/amplifier/chain-integration/relay-messages>

### Starknet to EVM

- Note: The final execute step of the GMP call on EVM can be performed via:

```bash
# Change `PRIVATE_KEY` in `.env` to EVM
PRIVATE_KEY=<evm_deployer_key>

ts-node evm/gateway.js -n [destination-chain] --action execute --payload $PAYLOAD --sourceChain axelar --sourceAddress $ITS_HUB_ADDRESS --messageId [message-id] --destination [destination-address]
```

1. Deploy Native Interchain Token

```bash
npx ts-node starknet/its/itf.ts deploy-interchain-token \
  --salt [salt] \
  --name "Test Token" \
  --symbol TEST \
  --decimals 18 \
  --initialSupply 1000000 \
  --minter $STARKNET_ACCOUNT_ADDRESS \
  --env $ENV \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS

npx ts-node starknet/its/itf.ts deploy-remote-interchain-token \
  --salt [salt] \
  --destinationChain [destination-chain] \
  --gasValue 1000000 \
  --env $ENV \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS
```

2. Interchain Token Transfer for Native Interchain Token

```bash
npx ts-node starknet/its/its.ts interchain-transfer \
  --tokenId [token-id] \
  --destinationChain [destination-chain] \
  --destinationAddress [destination-address] \
  --amount [amount] \
  --gasValue 1000000 \
  --env $ENV \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS
```

3. Deploy Remote Canonical Token

```bash
# Register existing token as canonical
npx ts-node starknet/its/itf.ts register-canonical-interchain-token \
  --tokenAddress [token-address] \
  --env $ENV \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS

# Deploy to remote chain
npx ts-node starknet/its/itf.ts deploy-remote-canonical-interchain-token \
  --tokenAddress [token-address] \
  --destinationChain [destination-chain] \
  --gasValue 1000000 \
  --env $ENV \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS
```

4. Interchain Token Transfer for Canonical Token

```bash
npx ts-node starknet/its/its.ts interchain-transfer \
  --tokenId [token-id] \
  --destinationChain [destination-chain] \
  --destinationAddress [destination-address] \
  --amount [amount] \
  --gasValue 1000000 \
  --env $ENV \
  --privateKey $STARKNET_PRIVATE_KEY \
  --accountAddress $STARKNET_ACCOUNT_ADDRESS
```

### EVM to Starknet

- Note: The final execute step of the GMP call on Starknet can be performed via:

```bash
# Change `STARKNET_PRIVATE_KEY` in `.env` to Starknet
STARKNET_PRIVATE_KEY=<starknet_deployer_key>
STARKNET_ACCOUNT_ADDRESS=<starknet_account_address>

# First approve the message
npx ts-node starknet/gateway.ts approve-messages '[{"source_chain": "[source-chain]", "message_id": "[message-id]", "source_address": "[source-address]", "contract_address": "[its-address]", "payload_hash": "[payload-hash]"}]' '{"signers": {"signers": [{"signer": "[signer]", "weight": 1}], "threshold": 1, "nonce": "[nonce]"}, "signatures": [[signature-bytes]]}' --env $ENV --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS

# Then validate the message
npx ts-node starknet/gateway.ts validate-message [source-chain] [message-id] [source-address] [payload-hash] --env $ENV --privateKey $STARKNET_PRIVATE_KEY --accountAddress $STARKNET_ACCOUNT_ADDRESS
```

1. Deploy Native Interchain Token

```bash
ts-node evm/interchainTokenFactory.js --action deployInterchainToken -n [source-chain] --destinationChain $CHAIN --salt "salt" --name "test" --symbol "TEST" --decimals 18

# Adjust `--gasValue` or add gas directly from axelarscan for mainnet
ts-node evm/interchainTokenFactory.js --action deployRemoteInterchainToken -n [source-chain] --destinationChain $CHAIN --salt "salt" --gasValue 1000000000000000000
```

2. Interchain Token Transfer for Native Interchain Token

```bash
ts-node evm/its.js --action interchainTransfer -n [source-chain] --destinationChain $CHAIN --destinationAddress [encoded-recipient] --tokenId [token-id] --amount [amount]
```

3. Deploy Remote Canonical Token

```bash
ts-node evm/interchainTokenFactory.js --action registerCanonicalInterchainToken -n [source-chain] --destinationChain $CHAIN --tokenAddress [token-address]

ts-node evm/interchainTokenFactory.js --action deployRemoteCanonicalInterchainToken -n [source-chain] --destinationChain $CHAIN --tokenAddress [token-address] --gasValue 1000000000000000000
```

4. Interchain Token Transfer for Canonical Token

```bash
ts-node evm/its.js --action interchainTransfer -n [source-chain] --destinationChain $CHAIN --destinationAddress [encoded-recipient] --tokenId [token-id] --amount [amount] --gasValue 1000000000000000000
```
