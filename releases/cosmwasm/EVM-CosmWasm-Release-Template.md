# &lt; ChainName &gt; GMP Amplifier vX.X.X

|                | **Owner**                                 |
| -------------- | ----------------------------------------- |
| **Created By** | @yourGithubUsername <user@interoplabs.io> |
| **Deployment** | @yourGithubUsername <user@interoplabs.io> |

| **Network**          | **Deployment Status** | **Date** |
| -------------------- | --------------------- | -------- |
| **Devnet Amplifier** | -                     | TBD      |
| **Stagenet**         | -                     | TBD      |
| **Testnet**          | -                     | TBD      |
| **Mainnet**          | -                     | TBD      |

- [Amplifier Releases](https://github.com/axelarnetwork/axelar-amplifier/releases)
- [VotingVerifier vX.X.X](https://github.com/axelarnetwork/axelar-amplifier/releases/tag/voting-verifier-v1.1.0) `add link to Voting Verifier release`
- [Gateway vX.X.X](https://github.com/axelarnetwork/axelar-amplifier/releases/tag/gateway-v1.1.1) `add link to Gateway release`
- [MultisigProver vX.X.X](https://github.com/axelarnetwork/axelar-amplifier/releases/tag/multisig-prover-v1.1.1) `add link to Multisig Prover release`

## Background

These are the instructions for deploying Amplifier contracts for `<ChainName>` connection.

### Pre-requisites

Predict the [External Gateway](../evm/path-to-GMP-release-doc) address, as `VotingVerifier` deployment requires the `sourceGatewayAddress` which is the External Gateway address.

| Network              | `minimumRotationDelay` | `deploymentType` | `deployer`                                   |
| -------------------- | ---------------------- | ---------------- | -------------------------------------------- |
| **Devnet-amplifier** | `0`                    | `create3`        | `0xba76c6980428A0b10CFC5d8ccb61949677A61233` |
| **Stagenet**         | `300`                  | `create`         | `0xBeF25f4733b9d451072416360609e5A4c115293E` |
| **Testnet**          | `3600`                 | `create`         | `0xB8Cd93C83A974649D76B1c19f311f639e62272BC` |
| **Mainnet**          | `86400`                | `create`         | `0xB8Cd93C83A974649D76B1c19f311f639e62272BC` |

```bash
ts-node evm/deploy-amplifier-gateway.js -m [deploymentType] --minimumRotationDelay [minimumRotationDelay] --predictOnly
```

## Deployment

- Create an `.env` config

```yaml
MNEMONIC=<cosm wasm deployer key mnemonic>
ENV=<devnet-amplifier|stagenet|testnet|mainnet>
CHAIN=<chain name>
```

| Network              | `deployer address`                              |
| -------------------- | ----------------------------------------------- |
| **Devnet-amplifier** | `axelar1zlr7e5qf3sz7yf890rkh9tcnu87234k6k7ytd9` |
| **Stagenet**         | `axelar1pumrull7z8y5kc9q4azfrmcaxd8w0779kg6anm` |
| **Testnet**          | `axelar1uk66drc8t9hwnddnejjp92t22plup0xd036uc2` |
| **Mainnet**          | `axelar1uk66drc8t9hwnddnejjp92t22plup0xd036uc2` |

- Confirm `VotingVerifier`, `Gateway` and `MultisigProver` contracts are already stored in `$ENV.json`

```bash
VotingVerifier (v1.1.0) -> "storeCodeProposalCodeHash": "d9412440820a51bc48bf41a77ae39cfb33101ddc6562323845627ea2042bf708"
Gateway (v1.1.1) -> "storeCodeProposalCodeHash": "2ba600ee0d162184c9387eaf6fad655f1d75db548f93e379f0565cb2042d856f"
MultisigProver (v1.1.1) -> "storeCodeProposalCodeHash": "00428ef0483f103a6e1a5853c4b29466a83e5b180cc53a00d1ff9d022bc2f03a"
```

- Add config in `$ENV.json` to deploy Amplifier contracts.

| Network              | `governanceAddress`                             | `adminAddress`                                  |
| -------------------- | ----------------------------------------------- | ----------------------------------------------- |
| **Devnet-amplifier** | `axelar1zlr7e5qf3sz7yf890rkh9tcnu87234k6k7ytd9` | `axelar1zlr7e5qf3sz7yf890rkh9tcnu87234k6k7ytd9` |
| **Stagenet**         | `axelar10d07y265gmmuvt4z0w9aw880jnsr700j7v9daj` | `axelar1l7vz4m5g92kvga050vk9ycjynywdlk4zhs07dv` |
| **Testnet**          | `axelar10d07y265gmmuvt4z0w9aw880jnsr700j7v9daj` | `axelar17qafmnc4hrfa96cq37wg5l68sxh354pj6eky35` |
| **Mainnet**          | `axelar10d07y265gmmuvt4z0w9aw880jnsr700j7v9daj` | `axelar1pczf792wf3p3xssk4dmwfxrh6hcqnrjp70danj` |

| Network              | `serviceName` | `votingThreshold` | `signingThreshold` | `confirmationHeight` |
| -------------------- | ------------- | ----------------- | ------------------ | -------------------- |
| **Devnet-amplifier** | `validators`  | `["6", "10"]`     | `["6", "10"]`      | `1`                  |
| **Stagenet**         | `amplifier`   | `["51", "100"]`   | `["51", "100"]`    | `1`                  |
| **Testnet**          | `amplifier`   | `["51", "100"]`   | `["51", "100"]`    | `1`                  |
| **Mainnet**          | `amplifier`   | `["2", "3"]`      | `["2", "3"]`       | `1`                  |

```bash
# Add under `config.axelar.contracts.VotingVerifier` based on Network
"$CHAIN" : {
  "governanceAddress": "[governance address]",
  "serviceName": "[service name]",
  "sourceGatewayAddress": "[external gateway address]",
  "votingThreshold": "[voting threshold]",
  "blockExpiry": 10,
  "confirmationHeight": 1000000, # if $CHAIN uses a custom finality mechanism such as the "finalized" tag, set this value very high (i.e. 1000000) to prevent accidental use
  "msgIdFormat": "hex_tx_hash_and_event_index",
  "addressFormat": "eip55"
}

# Add under `config.axelar.contracts.MultisigProver` based on Network
"$CHAIN" : {
  "governanceAddress": "[governance address]",
  "adminAddress": "[admin address]",
  "signingThreshold": "[signing threshold]",
  "serviceName": "[service name]",
  "verifierSetDiffThreshold": 0,
  "encoder": "abi",
  "keyType": "ecdsa"
}
```

### Instantiate Amplifier contracts

| Network              | `CONTRACT_ADMIN`                                |
| -------------------- | ----------------------------------------------- |
| **Devnet-amplifier** | `axelar1zlr7e5qf3sz7yf890rkh9tcnu87234k6k7ytd9` |
| **Stagenet**         | `axelar12qvsvse32cjyw60ztysd3v655aj5urqeup82ky` |
| **Testnet**          | `axelar12f2qn005d4vl03ssjq07quz6cja72w5ukuchv7` |
| **Mainnet**          | `axelar1nctnr9x0qexemeld5w7w752rmqdsqqv92dw9am` |

`CONTRACT_ADMIN` is the wasm contract admin address for contract upgrades.

1. Instantiate `VotingVerifier`

```bash
ts-node ./cosmwasm/deploy-contract.js instantiate -c VotingVerifier --fetchCodeId --instantiate2 --admin $CONTRACT_ADMIN
```

2. Instantiate `Gateway`

```bash
ts-node ./cosmwasm/deploy-contract.js instantiate -c Gateway --fetchCodeId --instantiate2 --admin $CONTRACT_ADMIN
```

3. Instantiate `MultisigProver`

```bash
ts-node ./cosmwasm/deploy-contract.js instantiate -c MultisigProver --fetchCodeId --instantiate2 --admin $CONTRACT_ADMIN
```

4. Set environment variables

- These variables are network-specific

```bash
VOTING_VERIFIER=$(cat ./axelar-chains-config/info/$ENV.json | jq ".axelar.contracts.VotingVerifier[\"$CHAIN\"].address" | tr -d '"')
GATEWAY=$(cat ./axelar-chains-config/info/$ENV.json | jq ".axelar.contracts.Gateway[\"$CHAIN\"].address" | tr -d '"')
MULTISIG_PROVER=$(cat ./axelar-chains-config/info/$ENV.json | jq ".axelar.contracts.MultisigProver[\"$CHAIN\"].address" | tr -d '"')
MULTISIG=$(cat ./axelar-chains-config/info/$ENV.json | jq .axelar.contracts.Multisig.address | tr -d '"')
REWARDS=$(cat ./axelar-chains-config/info/$ENV.json | jq .axelar.contracts.Rewards.address | tr -d '"')
ROUTER=$(cat ./axelar-chains-config/info/$ENV.json | jq .axelar.contracts.Router.address | tr -d '"')
```

- Gov proposal environment variables. Update these for each network

| Network              | `PROVER_ADMIN`                                  | `REWARD_AMOUNT`     |
| -------------------- | ----------------------------------------------- | ------------------- |
| **Devnet-amplifier** | `axelar1zlr7e5qf3sz7yf890rkh9tcnu87234k6k7ytd9` | `1000000uamplifier` |
| **Stagenet**         | `axelar1l7vz4m5g92kvga050vk9ycjynywdlk4zhs07dv` | `1000000uaxl`       |
| **Testnet**          | `axelar17qafmnc4hrfa96cq37wg5l68sxh354pj6eky35` | `1000000uaxl`       |
| **Mainnet**          | `axelar1pczf792wf3p3xssk4dmwfxrh6hcqnrjp70danj` | `1000000uaxl`       |

```bash
PROVER_ADMIN=[prover admin who is responsible for the contract's operations]
REWARD_AMOUNT=[reward amount]
EPOCH_DURATION=[epoch duration according to the environment]
```

- Add a community post for the mainnet proposal. i.e: https://community.axelar.network/t/proposal-add-its-hub-to-mainnet/3227

- Note: all the following governance proposals should be submitted at one time so deployment doesn't get held up while waiting for voting. [ITS proposal](../evm/EVM-ITS-Release-Template.md) should also be submitted at this time if possible.

5. Register Gateway at the Router

```bash
ts-node cosmwasm/submit-proposal.js execute \
  -c Router \
  -t "Register Gateway for $CHAIN" \
  -d "Register Gateway address for $CHAIN at Router contract" \
  --msg "{
    \"register_chain\": {
      \"chain\": \"$CHAIN\",
      \"gateway_address\": \"$GATEWAY\",
      \"msg_id_format\": \"hex_tx_hash_and_event_index\"
      }
    }"
```

6. Register prover contract on coordinator

```bash
ts-node cosmwasm/submit-proposal.js execute \
  -c Coordinator \
  -t "Register Multisig Prover for $CHAIN" \
  -d "Register Multisig Prover address for $CHAIN at Coordinator contract" \
  --msg "{
    \"register_prover_contract\": {
      \"chain_name\": \"$CHAIN\",
      \"new_prover_addr\": \"$MULTISIG_PROVER\"
    }
  }"
```

7. Authorize `$CHAIN` Multisig Prover on Multisig

```bash
ts-node cosmwasm/submit-proposal.js execute \
  -c Multisig \
  -t "Authorize Multisig Prover for $CHAIN" \
  -d "Authorize Multisig Prover address for $CHAIN at Multisig contract" \
  --msg "{
    \"authorize_callers\": {
      \"contracts\": {
        \"$MULTISIG_PROVER\": \"$CHAIN\"
      }
    }
  }"
```

8. Create reward pool for voting verifier

#### Rewards

| Network              | `epoch_duration` | `participation_threshold` | `rewards_per_epoch` |
| -------------------- | ---------------- | ------------------------- | ------------------- |
| **Devnet-amplifier** | `100`            | `[\"7\", \"10\"]`         | `100`               |
| **Stagenet**         | `600`            | `[\"7\", \"10\"]`         | `100`               |
| **Testnet**          | `600`            | `[\"7\", \"10\"]`         | `100`               |
| **Mainnet**          | `14845`          | `[\"8\", \"10\"]`         | `TBD`               |

```bash
ts-node cosmwasm/submit-proposal.js execute \
  -c Rewards \
  -t "Create pool for $CHAIN in $CHAIN voting verifier" \
  -d "Create pool for $CHAIN in $CHAIN voting verifier" \
  --msg "{
    \"create_pool\": {
      \"params\": {
        \"epoch_duration\": \"$EPOCH_DURATION\",
        \"participation_threshold\": [participation threshold],
        \"rewards_per_epoch\": \"[rewards per epoch]\"
      },
      \"pool_id\": {
        \"chain_name\": \"$CHAIN\",
        \"contract\": \"$VOTING_VERIFIER\"
      }
    }
  }"
```

9. Create reward pool for multisig

```bash
ts-node cosmwasm/submit-proposal.js execute \
  -c Rewards \
  -t "Create pool for $CHAIN in axelar multisig" \
  -d "Create pool for $CHAIN in axelar multisig" \
  --msg "{
    \"create_pool\": {
      \"params\": {
        \"epoch_duration\": \"$EPOCH_DURATION\",
        \"participation_threshold\": [participation threshold],
        \"rewards_per_epoch\": \"[rewards per epoch]\"
      },
      \"pool_id\": {
        \"chain_name\": \"$CHAIN\",
        \"contract\": \"$MULTISIG\"
      }
    }
  }"
```

10. Register ITS edge contract on ITS Hub

Proceed with this step only if ITS deployment on $CHAIN is confirmed. Add the following to `contracts` in the `$CHAIN` config within `ENV.json`:

| Network              | `ITS_EDGE_CONTRACT`                          |
| -------------------- | -------------------------------------------- |
| **Devnet-amplifier** | `0x2269B93c8D8D4AfcE9786d2940F5Fcd4386Db7ff` |
| **Stagenet**         | `0x0FCb262571be50815627C16Eca1f5F3D342FF5a5` |
| **Testnet**          | `0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C` |
| **Mainnet**          | `0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C` |

```json
{
  "InterchainTokenService": {
    "address": "$ITS_EDGE_CONTRACT"
  }
}
```

```bash
ts-node cosmwasm/submit-proposal.js \
    its-hub-register-chains $CHAIN \
    -t "Register $CHAIN on ITS Hub" \
    -d "Register $CHAIN on ITS Hub"
```

- Please remove this temporary config after submitting the proposal and reset contracts to an empty object.

11. Add funds to reward pools from a wallet containing the reward funds `$REWARD_AMOUNT`

```bash
axelard tx wasm execute $REWARDS "{ \"add_rewards\": { \"pool_id\": { \"chain_name\": \"$CHAIN\", \"contract\": \"$MULTISIG\" } } }" --amount $REWARD_AMOUNT --from $WALLET

axelard tx wasm execute $REWARDS "{ \"add_rewards\": { \"pool_id\": { \"chain_name\": \"$CHAIN\", \"contract\": \"$VOTING_VERIFIER\" } } }" --amount $REWARD_AMOUNT --from $WALLET
```

12. Confirm proposals have passed

- Check proposals on block explorer (i.e. https://axelarscan.io/proposals)
  - "Register Gateway for `$CHAIN`"
  - "Register Multisig Prover for `$CHAIN`"
  - "Authorize Multisig Prover for `$CHAIN`"
  - "Create pool for `$CHAIN` in `$CHAIN` voting verifier"
  - "Create pool for `$CHAIN` in axelar multisig"
  - (optional) "Register `$CHAIN` on ITS Hub"

- Check Gateway registered at Router
```bash
axelard q wasm contract-state smart $ROUTER "{\"chain_info\": \"$CHAIN\"}" --output json | jq .
# You should see something like this:
{
  "data": {
    "name": \"$CHAIN\",
    "gateway": {
      "address": "axelar1jah3ac59xke2r266yjhh45tugzsvnlzsefyvx6jgp0msk6tp7vqqaktuz2"
    },
    "frozen_status": 0,
    "msg_id_format": "hex_tx_hash_and_event_index"
  }
}
```

- Check Multisig Prover authorized on Multisig
```bash
axelard q wasm contract-state smart $MULTISIG "{\"is_caller_authorized\": {\"contract_address\": \"$MULTISIG_PROVER\", \"chain_name\": \"$CHAIN\"}}" --output json | jq .
# Result should look like:
{
  "data": true
}
```

- Check reward pool to confirm funding worked:

```bash
ts-node cosmwasm/query.js rewards -n $CHAIN
```

13. Update `ampd` with the `$CHAIN` chain configuration. Verifiers should use their own `$CHAIN` RPC node for the `http_url` in production.

| Network              | `http_url`        |
| -------------------- | ----------------- |
| **Devnet-amplifier** | [testnet RPC URL] |
| **Stagenet**         | [testnet RPC URL] |
| **Testnet**          | [testnet RPC URL] |
| **Mainnet**          | [mainnet RPC URL] |

```bash
[[handlers]]
chain_name="$CHAIN"
cosmwasm_contract="$MULTISIG"
type="MultisigSigner"

[[handlers]]
chain_finalization="RPCFinalizedBlock"
chain_name="$CHAIN"
chain_rpc_url=[http url]
cosmwasm_contract="$VOTING_VERIFIER"
type="EvmMsgVerifier"

[[handlers]]
chain_finalization="RPCFinalizedBlock"
chain_name="$CHAIN"
chain_rpc_url=[http url]
cosmwasm_contract="$VOTING_VERIFIER"
type="EvmVerifierSetVerifier"
```

14. Update `ampd` with the `$CHAIN` chain configuration.

```bash
ampd register-chain-support "[service name]" $CHAIN
```

15. Create genesis verifier set

Note that this step can only be run once a sufficient number of verifiers have registered.

| Network              | `min_num_verifiers` |
| -------------------- | ------------------- |
| **Devnet-amplifier** | 3                   |
| **Stagenet**         | 3                   |
| **Testnet**          | 5                   |
| **Mainnet**          | 5                   |

```bash
axelard tx wasm execute $MULTISIG_PROVER '"update_verifier_set"' --from $PROVER_ADMIN --gas auto --gas-adjustment 1.2
```

Query the multisig prover for active verifier set

```bash
axelard q wasm contract-state smart $MULTISIG_PROVER '"current_verifier_set"'
```

## Checklist

The [GMP checklist for $CHAIN](../evm/path-to-GMP-release-doc) will test GMP calls.
