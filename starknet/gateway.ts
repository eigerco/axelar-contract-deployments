

import { Command } from 'commander';
import { loadConfig } from '../common';
import { addStarknetOptions } from './cli-utils';

// Constant for Starknet chain name in config
const STARKNET_CHAIN = 'starknet';
import {
    getStarknetProvider,
    getStarknetAccount,
    getContractConfig,
    handleOfflineTransaction,
    validateStarknetOptions,
    estimateGasAndDisplayArgs,
} from './utils';
import { uint256, num, Contract, CallData, byteArray, Call, Provider, Account } from 'starknet';
import {
    Config,
    ChainConfig,
    GatewayCommandOptions,
    OfflineTransactionResult
} from './types';

/**
 * Helper function to get gateway contract instance with ABI
 */
async function getGatewayContract(
    provider: Provider,
    address: string,
    account?: Account
): Promise<Contract> {
    const { abi } = await provider.getClassAt(address);
    const contract = new Contract(abi, address, provider);
    if (account) {
        contract.connect(account);
    }
    return contract;
}

/**
 * Common function to handle gas estimation for gateway operations
 */
async function handleGasEstimation(
    chain: ChainConfig & { name: string },
    options: GatewayCommandOptions,
    contractAddress: string,
    entrypoint: string,
    calldata: any[]
): Promise<Record<string, never>> {
    console.log(`\nEstimating gas for ${entrypoint} on ${chain.name}...`);

    const provider = getStarknetProvider(chain);
    const account = getStarknetAccount(options.privateKey!, options.accountAddress!, provider);
    const calls: Call[] = [{
        contractAddress,
        entrypoint,
        calldata
    }];

    await estimateGasAndDisplayArgs(account, calls);
    return {}; // Return empty for estimation
}

async function callContract(
    config: Config,
    chain: ChainConfig & { name: string },
    options: GatewayCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        destinationChain,
        destinationContractAddress,
        payload,
        offline,
        estimate,
    } = options;

    const provider = getStarknetProvider(chain);

    const gatewayConfig = getContractConfig(config, chain.name, 'AxelarGateway');
    if (!gatewayConfig.address) {
        throw new Error('AxelarGateway contract not found in configuration');
    }

    console.log(`Calling contract on destination chain: ${destinationChain}`);
    console.log(`Destination contract address: ${destinationContractAddress}`);
    console.log(`Payload: ${payload}`);

    const calldata = CallData.compile([
        destinationChain, // felt252
        byteArray.byteArrayFromString(destinationContractAddress),
        byteArray.byteArrayFromString(payload),
    ]);

    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, gatewayConfig.address, 'call_contract', hexCalldata);
    }

    if (offline) {
        const calls: Call[] = [{
            contractAddress: gatewayConfig.address,
            entrypoint: 'call_contract',
            calldata: hexCalldata
        }];
        return handleOfflineTransaction(options, chain.name, calls, 'call_contract');
    }

    // Online execution
    const account = getStarknetAccount(privateKey, accountAddress, provider);
    const gatewayContract = await getGatewayContract(provider, gatewayConfig.address, account);

    const response = await gatewayContract.call_contract(calldata);
    await account.waitForTransaction(response.transaction_hash);

    console.log(`Call contract transaction sent!`);
    console.log(`Transaction Hash: ${response.transaction_hash}`);

    return response;
}

async function approveMessages(
    config: Config,
    chain: ChainConfig & { name: string },
    options: GatewayCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        messages,
        proof,
        offline,
        estimate,
    } = options;

    const gatewayConfig = getContractConfig(config, chain.name, 'AxelarGateway');
    if (!gatewayConfig.address) {
        throw new Error('AxelarGateway contract not found in configuration');
    }

    console.log(`Approving ${messages.length} messages on ${chain.name}`);

    const formattedMessages = messages.map(msg => ({
        source_chain: byteArray.byteArrayFromString(msg.source_chain),
        message_id: byteArray.byteArrayFromString(msg.message_id),
        source_address: byteArray.byteArrayFromString(msg.source_address),
        contract_address: msg.contract_address,
        payload_hash: uint256.bnToUint256(msg.payload_hash)
    }));

    const formattedProof = {
        signers: {
            signers: proof.signers.signers.map(signer => ({
                signer: signer.signer,
                weight: signer.weight
            })),
            threshold: proof.signers.threshold,
            nonce: uint256.bnToUint256(proof.signers.nonce)
        },
        signatures: proof.signatures
    };

    const calldata = CallData.compile([
        formattedMessages,
        formattedProof
    ]);

    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, gatewayConfig.address, 'approve_messages', hexCalldata);
    }

    if (offline) {
        const calls: Call[] = [{
            contractAddress: gatewayConfig.address,
            entrypoint: 'approve_messages',
            calldata: hexCalldata
        }];
        return handleOfflineTransaction(options, chain.name, calls, 'approve_messages');
    }

    // Online execution
    const provider = getStarknetProvider(chain);
    const account = getStarknetAccount(privateKey, accountAddress, provider);
    const gatewayContract = await getGatewayContract(provider, gatewayConfig.address, account);

    console.log("KOR", calldata);
    const response = await gatewayContract.approve_messages(calldata);
    await account.waitForTransaction(response.transaction_hash);

    console.log(`Messages approved successfully!`);
    console.log(`Transaction Hash: ${response.transaction_hash}`);

    return response;
}

async function validateMessage(
    config: Config,
    chain: ChainConfig & { name: string },
    options: GatewayCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        sourceChain,
        messageId,
        sourceAddress,
        payloadHash,
        offline,
        estimate,
    } = options;

    const gatewayConfig = getContractConfig(config, chain.name, 'AxelarGateway');
    if (!gatewayConfig.address) {
        throw new Error('AxelarGateway contract not found in configuration');
    }

    console.log(`Validating message from ${sourceChain}`);
    console.log(`Message ID: ${messageId}`);
    console.log(`Source Address: ${sourceAddress}`);
    console.log(`Payload Hash: ${payloadHash}`);

    const calldata = CallData.compile([
        byteArray.byteArrayFromString(sourceChain),
        byteArray.byteArrayFromString(messageId),
        byteArray.byteArrayFromString(sourceAddress),
        payloadHash, // u256
    ]);

    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, gatewayConfig.address, 'validate_message', hexCalldata);
    }

    if (offline) {
        const calls: Call[] = [{
            contractAddress: gatewayConfig.address,
            entrypoint: 'validate_message',
            calldata: hexCalldata
        }];
        return handleOfflineTransaction(options, chain.name, calls, 'validate_message');
    }

    // Online execution
    const provider = getStarknetProvider(chain);
    const account = getStarknetAccount(privateKey, accountAddress, provider);
    const gatewayContract = await getGatewayContract(provider, gatewayConfig.address, account);

    const response = await gatewayContract.validate_message(calldata);
    await account.waitForTransaction(response.transaction_hash);

    console.log(`Message validation completed!`);
    console.log(`Transaction Hash: ${response.transaction_hash}`);

    return response;
}

async function rotateSigners(
    config: Config,
    chain: ChainConfig & { name: string },
    options: GatewayCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        newSigners,
        proof,
        offline,
        estimate,
    } = options;

    const gatewayConfig = getContractConfig(config, chain.name, 'AxelarGateway');
    if (!gatewayConfig.address) {
        throw new Error('AxelarGateway contract not found in configuration');
    }

    console.log(`Rotating signers on ${chain.name}`);
    console.log(`New signers: ${JSON.stringify(newSigners)}`);

    // Format proof with nested structures (newSigners is already properly structured)
    const formattedProof = {
        signers: proof.signers, // WeightedSigners struct
        signatures: proof.signatures // Array<Array<u8>>
    };

    const calldata = CallData.compile([
        newSigners, // WeightedSigners - already properly structured
        formattedProof
    ]);

    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, gatewayConfig.address, 'rotate_signers', hexCalldata);
    }

    if (offline) {
        const calls: Call[] = [{
            contractAddress: gatewayConfig.address,
            entrypoint: 'rotate_signers',
            calldata: hexCalldata
        }];
        return handleOfflineTransaction(options, chain.name, calls, 'rotate_signers');
    }

    // Online execution
    const provider = getStarknetProvider(chain);
    const account = getStarknetAccount(privateKey, accountAddress, provider);
    const gatewayContract = await getGatewayContract(provider, gatewayConfig.address, account);

    const response = await gatewayContract.rotate_signers(newSigners, formattedProof);
    await account.waitForTransaction(response.transaction_hash);

    console.log(`Signers rotated successfully!`);
    console.log(`Transaction Hash: ${response.transaction_hash}`);

    return response;
}

async function isMessageApproved(config: Config, chain: ChainConfig & { name: string }, options: GatewayCommandOptions): Promise<boolean> {
    const {
        sourceChain,
        messageId,
        sourceAddress,
        contractAddress,
        payloadHash,
    } = options;

    const provider = getStarknetProvider(chain);

    const gatewayConfig = getContractConfig(config, chain.name, 'AxelarGateway');
    if (!gatewayConfig.address) {
        throw new Error('AxelarGateway contract not found in configuration');
    }

    const gatewayContract = await getGatewayContract(provider, gatewayConfig.address);

    const result = await gatewayContract.is_message_approved(
        byteArray.byteArrayFromString(sourceChain),
        byteArray.byteArrayFromString(messageId),
        byteArray.byteArrayFromString(sourceAddress),
        contractAddress, // ContractAddress
        payloadHash, // u256
    );

    console.log(`Message approved status: ${result}`);
    return result;
}

async function isMessageExecuted(config: Config, chain: ChainConfig & { name: string }, options: GatewayCommandOptions): Promise<boolean> {
    const {
        sourceChain,
        messageId,
    } = options;

    const provider = getStarknetProvider(chain);

    const gatewayConfig = getContractConfig(config, chain.name, 'AxelarGateway');
    if (!gatewayConfig.address) {
        throw new Error('AxelarGateway contract not found in configuration');
    }

    const gatewayContract = await getGatewayContract(provider, gatewayConfig.address);

    const result = await gatewayContract.is_message_executed(
        byteArray.byteArrayFromString(sourceChain),
        byteArray.byteArrayFromString(messageId),
    );

    console.log(`Message executed status: ${result}`);
    return result;
}

async function transferOperatorship(
    config: Config,
    chain: ChainConfig & { name: string },
    options: GatewayCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        newOperator,
        offline,
        estimate,
    } = options;

    const provider = getStarknetProvider(chain);

    const gatewayConfig = getContractConfig(config, chain.name, 'AxelarGateway');
    if (!gatewayConfig.address) {
        throw new Error('AxelarGateway contract not found in configuration');
    }

    console.log(`Transferring operatorship to: ${newOperator}`);

    const calldata = CallData.compile([newOperator]);

    // Handle estimate mode
    if (estimate) {
        const hexCalldata = calldata.map(item => num.toHex(item));
        return handleGasEstimation(chain, options, gatewayConfig.address, 'transfer_operatorship', hexCalldata);
    }

    if (offline) {
        const hexCalldata = calldata.map(item => num.toHex(item));
        const calls: Call[] = [{
            contractAddress: gatewayConfig.address,
            entrypoint: 'transfer_operatorship',
            calldata: hexCalldata
        }];
        return handleOfflineTransaction(options, chain.name, calls, 'transfer_operatorship');
    }

    // Online execution
    const account = getStarknetAccount(privateKey, accountAddress, provider);
    const gatewayContract = await getGatewayContract(provider, gatewayConfig.address, account);

    const response = await gatewayContract.transfer_operatorship(calldata);
    await account.waitForTransaction(response.transaction_hash);

    console.log(`Operatorship transferred successfully!`);
    console.log(`Transaction Hash: ${response.transaction_hash}`);

    return response;
}

async function getOperator(config: Config, chain: ChainConfig & { name: string }, options: GatewayCommandOptions): Promise<string> {
    const provider = getStarknetProvider(chain);

    const gatewayConfig = getContractConfig(config, chain.name, 'AxelarGateway');
    if (!gatewayConfig.address) {
        throw new Error('AxelarGateway contract not found in configuration');
    }

    const gatewayContract = await getGatewayContract(provider, gatewayConfig.address);

    const operator = await gatewayContract.operator();
    console.log(`Current operator: ${operator}`);
    return operator;
}

async function getEpoch(config: Config, chain: ChainConfig & { name: string }, options: GatewayCommandOptions): Promise<string> {
    const provider = getStarknetProvider(chain);

    const gatewayConfig = getContractConfig(config, chain.name, 'AxelarGateway');
    if (!gatewayConfig.address) {
        throw new Error('AxelarGateway contract not found in configuration');
    }

    const gatewayContract = await getGatewayContract(provider, gatewayConfig.address);

    const epoch = await gatewayContract.epoch();
    console.log(`Current epoch: ${epoch}`);
    return epoch;
}

async function main(): Promise<void> {
    const program = new Command();

    program
        .name('gateway')
        .description('Interact with Axelar Gateway on Starknet')
        .version('1.0.0');

    // Call contract command
    const callContractCmd = program
        .command('call-contract')
        .description('Call a contract on another chain')
        .argument('<destinationChain>', 'destination chain name (as felt252)')
        .argument('<destinationContractAddress>', 'destination contract address')
        .argument('<payload>', 'payload to send');

    addStarknetOptions(callContractCmd, { offlineSupport: true });

    callContractCmd.action(async (destinationChain, destinationContractAddress, payload, options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const cmdOptions = {
                ...options,
                destinationChain,
                destinationContractAddress,
                payload,
            };

            const result = await callContract(config, { ...chain, name: STARKNET_CHAIN }, cmdOptions);
            console.log(`✅ call-contract completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ call-contract failed for ${STARKNET_CHAIN}: ${error.message}\n`);
            process.exit(1);
        }
    });

    // Approve messages command
    const approveCmd = program
        .command('approve-messages')
        .description('Approve messages')
        .argument('<messages>', 'messages JSON array')
        .argument('<proof>', 'proof object');

    addStarknetOptions(approveCmd, { offlineSupport: true });

    approveCmd.action(async (messages, proof, options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const cmdOptions = {
                ...options,
                messages: JSON.parse(messages),
                proof: JSON.parse(proof),
            };

            const result = await approveMessages(config, { ...chain, name: STARKNET_CHAIN }, cmdOptions);
            console.log(`✅ approve-messages completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ approve-messages failed for ${STARKNET_CHAIN}: ${error.message}\n`);
            process.exit(1);
        }
    });

    // Validate message command
    const validateCmd = program
        .command('validate-message')
        .description('Validate a message')
        .argument('<sourceChain>', 'source chain name')
        .argument('<messageId>', 'message ID')
        .argument('<sourceAddress>', 'source address')
        .argument('<payloadHash>', 'payload hash');

    addStarknetOptions(validateCmd, { offlineSupport: true });

    validateCmd.action(async (sourceChain, messageId, sourceAddress, payloadHash, options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const cmdOptions = {
                ...options,
                sourceChain,
                messageId,
                sourceAddress,
                payloadHash,
            };

            const result = await validateMessage(config, { ...chain, name: STARKNET_CHAIN }, cmdOptions);
            console.log(`✅ validate-message completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ validate-message failed for ${STARKNET_CHAIN}: ${error.message}\n`);
            process.exit(1);
        }
    });

    // Rotate signers command
    const rotateCmd = program
        .command('rotate-signers')
        .description('Rotate gateway signers')
        .argument('<newSigners>', 'new signers (WeightedSigners JSON)')
        .argument('<proof>', 'proof object');

    addStarknetOptions(rotateCmd, { offlineSupport: true });

    rotateCmd.action(async (newSigners, proof, options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const cmdOptions = {
                ...options,
                newSigners: JSON.parse(newSigners),
                proof: JSON.parse(proof),
            };

            const result = await rotateSigners(config, { ...chain, name: STARKNET_CHAIN }, cmdOptions);
            console.log(`✅ rotate-signers completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ rotate-signers failed for ${STARKNET_CHAIN}: ${error.message}\n`);
            process.exit(1);
        }
    });

    // Query commands
    const isApprovedCmd = program
        .command('is-message-approved')
        .description('Check if message is approved')
        .argument('<sourceChain>', 'source chain name')
        .argument('<messageId>', 'message ID')
        .argument('<sourceAddress>', 'source address')
        .argument('<contractAddress>', 'contract address')
        .argument('<payloadHash>', 'payload hash');

    addStarknetOptions(isApprovedCmd, { ignorePrivateKey: true, ignoreAccountAddress: true });

    isApprovedCmd.action(async (sourceChain, messageId, sourceAddress, contractAddress, payloadHash, options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress, false);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const cmdOptions = {
                ...options,
                sourceChain,
                messageId,
                sourceAddress,
                contractAddress,
                payloadHash,
            };

            const result = await isMessageApproved(config, { ...chain, name: STARKNET_CHAIN }, cmdOptions);
            console.log(`✅ is-message-approved completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ is-message-approved failed for ${STARKNET_CHAIN}: ${error.message}\n`);
            process.exit(1);
        }
    });

    const isExecutedCmd = program
        .command('is-message-executed')
        .description('Check if message is executed')
        .argument('<sourceChain>', 'source chain name')
        .argument('<messageId>', 'message ID');

    addStarknetOptions(isExecutedCmd, { ignorePrivateKey: true, ignoreAccountAddress: true });

    isExecutedCmd.action(async (sourceChain, messageId, options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress, false);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const cmdOptions = {
                ...options,
                sourceChain,
                messageId,
            };

            const result = await isMessageExecuted(config, { ...chain, name: STARKNET_CHAIN }, cmdOptions);
            console.log(`✅ is-message-executed completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ is-message-executed failed for ${STARKNET_CHAIN}: ${error.message}\n`);
            process.exit(1);
        }
    });

    const transferOpCmd = program
        .command('transfer-operatorship')
        .description('Transfer gateway operatorship')
        .argument('<newOperator>', 'new operator address');

    addStarknetOptions(transferOpCmd, { offlineSupport: true });

    transferOpCmd.action(async (newOperator, options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const cmdOptions = {
                ...options,
                newOperator,
            };

            const result = await transferOperatorship(config, { ...chain, name: STARKNET_CHAIN }, cmdOptions);
            console.log(`✅ transfer-operatorship completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ transfer-operatorship failed for ${STARKNET_CHAIN}: ${error.message}\n`);
            process.exit(1);
        }
    });

    const getOperatorCmd = program
        .command('get-operator')
        .description('Get current operator');

    addStarknetOptions(getOperatorCmd, { ignorePrivateKey: true, ignoreAccountAddress: true });

    getOperatorCmd.action(async (options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress, false);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const result = await getOperator(config, { ...chain, name: STARKNET_CHAIN }, options);
            console.log(`✅ get-operator completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ get-operator failed for ${STARKNET_CHAIN}: ${error.message}\n`);
            process.exit(1);
        }
    });

    const getEpochCmd = program
        .command('get-epoch')
        .description('Get current epoch');

    addStarknetOptions(getEpochCmd, { ignorePrivateKey: true, ignoreAccountAddress: true });

    getEpochCmd.action(async (options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress, false);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const result = await getEpoch(config, { ...chain, name: STARKNET_CHAIN }, options);
            console.log(`✅ get-epoch completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ get-epoch failed for ${STARKNET_CHAIN}: ${error.message}\n`);
            process.exit(1);
        }
    });

    program.parse();
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

export {
    callContract,
    approveMessages,
    validateMessage,
    rotateSigners,
    isMessageApproved,
    isMessageExecuted,
    transferOperatorship,
    getOperator,
    getEpoch,
};
