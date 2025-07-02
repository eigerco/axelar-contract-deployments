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
    GovernanceCommandOptions,
    OfflineTransactionResult
} from './types';

/**
 * Helper function to get governance contract instance with ABI
 */
async function getGovernanceContract(
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
 * Common function to handle gas estimation for governance operations
 */
async function handleGasEstimation(
    chain: ChainConfig & { name: string },
    options: GovernanceCommandOptions,
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

// Read-only functions

async function governanceChain(config: Config, chain: ChainConfig & { name: string }, options: GovernanceCommandOptions): Promise<string> {
    const provider = getStarknetProvider(chain);

    const governanceConfig = getContractConfig(config, chain.name, 'Governance');
    if (!governanceConfig.address) {
        throw new Error('Governance contract not found in configuration');
    }

    const governanceContract = await getGovernanceContract(provider, governanceConfig.address);

    const result = await governanceContract.governance_chain();
    console.log(`Governance chain: ${result}`);
    return result;
}

async function governanceAddress(config: Config, chain: ChainConfig & { name: string }, options: GovernanceCommandOptions): Promise<string> {
    const provider = getStarknetProvider(chain);

    const governanceConfig = getContractConfig(config, chain.name, 'Governance');
    if (!governanceConfig.address) {
        throw new Error('Governance contract not found in configuration');
    }

    const governanceContract = await getGovernanceContract(provider, governanceConfig.address);

    const result = await governanceContract.governance_address();
    console.log(`Governance address: ${result}`);
    return result;
}

async function getProposalEta(
    config: Config,
    chain: ChainConfig & { name: string },
    options: GovernanceCommandOptions
): Promise<string> {
    const {
        target,
        entryPointSelector,
        callData,
        nativeValue,
    } = options;

    const provider = getStarknetProvider(chain);

    const governanceConfig = getContractConfig(config, chain.name, 'Governance');
    if (!governanceConfig.address) {
        throw new Error('Governance contract not found in configuration');
    }

    const governanceContract = await getGovernanceContract(provider, governanceConfig.address);

    // Parse calldata array from string
    const parsedCallData = JSON.parse(callData!);

    const compiledCalldata = CallData.compile([
        target!, // ContractAddress
        entryPointSelector!, // felt252
        parsedCallData, // Span<felt252>
        uint256.bnToUint256(nativeValue!), // u256
    ]);

    const result = await governanceContract.get_proposal_eta(compiledCalldata);
    console.log(`Proposal ETA: ${result}`);
    return result;
}

async function getTimeLock(
    config: Config,
    chain: ChainConfig & { name: string },
    options: GovernanceCommandOptions
): Promise<string> {
    const { hash } = options;

    const provider = getStarknetProvider(chain);

    const governanceConfig = getContractConfig(config, chain.name, 'Governance');
    if (!governanceConfig.address) {
        throw new Error('Governance contract not found in configuration');
    }

    const governanceContract = await getGovernanceContract(provider, governanceConfig.address);

    const result = await governanceContract.get_time_lock(hash);
    console.log(`Time lock for hash ${hash}: ${result}`);
    return result;
}

async function isOperatorProposalApproved(
    config: Config,
    chain: ChainConfig & { name: string },
    options: GovernanceCommandOptions
): Promise<boolean> {
    const {
        target,
        entryPointSelector,
        callData,
        nativeValue,
    } = options;

    const provider = getStarknetProvider(chain);

    const governanceConfig = getContractConfig(config, chain.name, 'Governance');
    if (!governanceConfig.address) {
        throw new Error('Governance contract not found in configuration');
    }

    const governanceContract = await getGovernanceContract(provider, governanceConfig.address);

    // Parse calldata array from string
    const parsedCallData = JSON.parse(callData!);
    
    const compiledCalldata = CallData.compile([
        target!, // ContractAddress
        entryPointSelector!, // felt252
        parsedCallData, // Span<felt252>
        uint256.bnToUint256(nativeValue!), // u256
    ]);

    const result = await governanceContract.is_operator_proposal_approved(compiledCalldata);
    console.log(`Operator proposal approved: ${result}`);
    return result;
}

// Write functions

async function executeProposal(
    config: Config,
    chain: ChainConfig & { name: string },
    options: GovernanceCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        target,
        entryPointSelector,
        callData,
        nativeValue,
        offline,
        estimate,
    } = options;

    const governanceConfig = getContractConfig(config, chain.name, 'Governance');
    if (!governanceConfig.address) {
        throw new Error('Governance contract not found in configuration');
    }

    console.log(`Executing proposal on ${chain.name}`);
    console.log(`Target: ${target}`);
    console.log(`Entry point selector: ${entryPointSelector}`);
    console.log(`Call data: ${callData}`);
    console.log(`Native value: ${nativeValue}`);

    // Parse calldata array from string
    const parsedCallData = JSON.parse(callData!);

    const compiledCalldata = CallData.compile([
        target!, // ContractAddress
        entryPointSelector!, // felt252
        parsedCallData, // Span<felt252>
        uint256.bnToUint256(nativeValue!), // u256
    ]);

    const hexCalldata = compiledCalldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, governanceConfig.address, 'execute_proposal', hexCalldata);
    }

    if (offline) {
        const calls: Call[] = [{
            contractAddress: governanceConfig.address,
            entrypoint: 'execute_proposal',
            calldata: hexCalldata
        }];
        return handleOfflineTransaction(options, chain.name, calls, 'execute_proposal');
    }

    // Online execution
    const provider = getStarknetProvider(chain);
    const account = getStarknetAccount(privateKey, accountAddress, provider);
    const governanceContract = await getGovernanceContract(provider, governanceConfig.address, account);

    const response = await governanceContract.execute_proposal(compiledCalldata);
    await account.waitForTransaction(response.transaction_hash);

    console.log(`Proposal executed successfully!`);
    console.log(`Transaction Hash: ${response.transaction_hash}`);

    return response;
}

async function executeOperatorProposal(
    config: Config,
    chain: ChainConfig & { name: string },
    options: GovernanceCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        target,
        entryPointSelector,
        callData,
        nativeValue,
        offline,
        estimate,
    } = options;

    const governanceConfig = getContractConfig(config, chain.name, 'Governance');
    if (!governanceConfig.address) {
        throw new Error('Governance contract not found in configuration');
    }

    console.log(`Executing operator proposal on ${chain.name}`);
    console.log(`Target: ${target}`);
    console.log(`Entry point selector: ${entryPointSelector}`);
    console.log(`Call data: ${callData}`);
    console.log(`Native value: ${nativeValue}`);

    // Parse calldata array from string
    const parsedCallData = JSON.parse(callData!);

    const compiledCalldata = CallData.compile([
        target!, // ContractAddress
        entryPointSelector!, // felt252
        parsedCallData, // Span<felt252>
        uint256.bnToUint256(nativeValue!), // u256
    ]);

    const hexCalldata = compiledCalldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, governanceConfig.address, 'execute_operator_proposal', hexCalldata);
    }

    if (offline) {
        const calls: Call[] = [{
            contractAddress: governanceConfig.address,
            entrypoint: 'execute_operator_proposal',
            calldata: hexCalldata
        }];
        return handleOfflineTransaction(options, chain.name, calls, 'execute_operator_proposal');
    }

    // Online execution
    const provider = getStarknetProvider(chain);
    const account = getStarknetAccount(privateKey, accountAddress, provider);
    const governanceContract = await getGovernanceContract(provider, governanceConfig.address, account);

    const response = await governanceContract.execute_operator_proposal(compiledCalldata);
    await account.waitForTransaction(response.transaction_hash);

    console.log(`Operator proposal executed successfully!`);
    console.log(`Transaction Hash: ${response.transaction_hash}`);

    return response;
}

async function withdraw(
    config: Config,
    chain: ChainConfig & { name: string },
    options: GovernanceCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        recipient,
        amount,
        offline,
        estimate,
    } = options;

    const governanceConfig = getContractConfig(config, chain.name, 'Governance');
    if (!governanceConfig.address) {
        throw new Error('Governance contract not found in configuration');
    }

    console.log(`Withdrawing from governance contract on ${chain.name}`);
    console.log(`Recipient: ${recipient}`);
    console.log(`Amount: ${amount}`);

    const calldata = CallData.compile([
        recipient!, // ContractAddress
        uint256.bnToUint256(amount!), // u256
    ]);

    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, governanceConfig.address, 'withdraw', hexCalldata);
    }

    if (offline) {
        const calls: Call[] = [{
            contractAddress: governanceConfig.address,
            entrypoint: 'withdraw',
            calldata: hexCalldata
        }];
        return handleOfflineTransaction(options, chain.name, calls, 'withdraw');
    }

    // Online execution
    const provider = getStarknetProvider(chain);
    const account = getStarknetAccount(privateKey, accountAddress, provider);
    const governanceContract = await getGovernanceContract(provider, governanceConfig.address, account);

    const response = await governanceContract.withdraw(calldata);
    await account.waitForTransaction(response.transaction_hash);

    console.log(`Withdrawal completed successfully!`);
    console.log(`Transaction Hash: ${response.transaction_hash}`);

    return response;
}

async function transferOperatorship(
    config: Config,
    chain: ChainConfig & { name: string },
    options: GovernanceCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        newOperator,
        offline,
        estimate,
    } = options;

    const provider = getStarknetProvider(chain);

    const governanceConfig = getContractConfig(config, chain.name, 'Governance');
    if (!governanceConfig.address) {
        throw new Error('Governance contract not found in configuration');
    }

    console.log(`Transferring operatorship to: ${newOperator}`);

    const calldata = CallData.compile([newOperator]);

    // Handle estimate mode
    if (estimate) {
        const hexCalldata = calldata.map(item => num.toHex(item));
        return handleGasEstimation(chain, options, governanceConfig.address, 'transfer_operatorship', hexCalldata);
    }

    if (offline) {
        const hexCalldata = calldata.map(item => num.toHex(item));
        const calls: Call[] = [{
            contractAddress: governanceConfig.address,
            entrypoint: 'transfer_operatorship',
            calldata: hexCalldata
        }];
        return handleOfflineTransaction(options, chain.name, calls, 'transfer_operatorship');
    }

    // Online execution
    const account = getStarknetAccount(privateKey, accountAddress, provider);
    const governanceContract = await getGovernanceContract(provider, governanceConfig.address, account);

    const response = await governanceContract.transfer_operatorship(calldata);
    await account.waitForTransaction(response.transaction_hash);

    console.log(`Operatorship transferred successfully!`);
    console.log(`Transaction Hash: ${response.transaction_hash}`);

    return response;
}

async function main(): Promise<void> {
    const program = new Command();

    program
        .name('governance')
        .description('Interact with Axelar Governance on Starknet')
        .version('1.0.0');

    // Read-only commands
    const governanceChainCmd = program
        .command('governance-chain')
        .description('Get the governance chain name');

    addStarknetOptions(governanceChainCmd, { ignorePrivateKey: true, ignoreAccountAddress: true });

    governanceChainCmd.action(async (options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress, false);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const result = await governanceChain(config, { ...chain, name: STARKNET_CHAIN }, options);
            console.log(`✅ governance-chain completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ governance-chain failed for ${STARKNET_CHAIN}: ${error.message}\n`);
            process.exit(1);
        }
    });

    const governanceAddressCmd = program
        .command('governance-address')
        .description('Get the governance address');

    addStarknetOptions(governanceAddressCmd, { ignorePrivateKey: true, ignoreAccountAddress: true });

    governanceAddressCmd.action(async (options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress, false);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const result = await governanceAddress(config, { ...chain, name: STARKNET_CHAIN }, options);
            console.log(`✅ governance-address completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ governance-address failed for ${STARKNET_CHAIN}: ${error.message}\n`);
            process.exit(1);
        }
    });

    const getProposalEtaCmd = program
        .command('get-proposal-eta')
        .description('Get the ETA of a proposal')
        .argument('<target>', 'target contract address')
        .argument('<entryPointSelector>', 'entry point selector (felt252)')
        .argument('<callData>', 'call data as JSON array of felt252')
        .argument('<nativeValue>', 'native value to send');

    addStarknetOptions(getProposalEtaCmd, { ignorePrivateKey: true, ignoreAccountAddress: true });

    getProposalEtaCmd.action(async (target, entryPointSelector, callData, nativeValue, options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress, false);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const cmdOptions = {
                ...options,
                target,
                entryPointSelector,
                callData,
                nativeValue,
            };

            const result = await getProposalEta(config, { ...chain, name: STARKNET_CHAIN }, cmdOptions);
            console.log(`✅ get-proposal-eta completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ get-proposal-eta failed for ${STARKNET_CHAIN}: ${error.message}\n`);
            process.exit(1);
        }
    });

    const getTimeLockCmd = program
        .command('get-time-lock')
        .description('Get the time lock for a given hash')
        .argument('<hash>', 'hash of the time lock (felt252)');

    addStarknetOptions(getTimeLockCmd, { ignorePrivateKey: true, ignoreAccountAddress: true });

    getTimeLockCmd.action(async (hash, options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress, false);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const cmdOptions = {
                ...options,
                hash,
            };

            const result = await getTimeLock(config, { ...chain, name: STARKNET_CHAIN }, cmdOptions);
            console.log(`✅ get-time-lock completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ get-time-lock failed for ${STARKNET_CHAIN}: ${error.message}\n`);
            process.exit(1);
        }
    });

    const isOperatorProposalApprovedCmd = program
        .command('is-operator-proposal-approved')
        .description('Check if an operator proposal is approved')
        .argument('<target>', 'target contract address')
        .argument('<entryPointSelector>', 'entry point selector (felt252)')
        .argument('<callData>', 'call data as JSON array of felt252')
        .argument('<nativeValue>', 'native value to send');

    addStarknetOptions(isOperatorProposalApprovedCmd, { ignorePrivateKey: true, ignoreAccountAddress: true });

    isOperatorProposalApprovedCmd.action(async (target, entryPointSelector, callData, nativeValue, options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress, false);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const cmdOptions = {
                ...options,
                target,
                entryPointSelector,
                callData,
                nativeValue,
            };

            const result = await isOperatorProposalApproved(config, { ...chain, name: STARKNET_CHAIN }, cmdOptions);
            console.log(`✅ is-operator-proposal-approved completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ is-operator-proposal-approved failed for ${STARKNET_CHAIN}: ${error.message}\n`);
            process.exit(1);
        }
    });

    // Write commands
    const executeProposalCmd = program
        .command('execute-proposal')
        .description('Execute a governance proposal')
        .argument('<target>', 'target contract address')
        .argument('<entryPointSelector>', 'entry point selector (felt252)')
        .argument('<callData>', 'call data as JSON array of felt252')
        .argument('<nativeValue>', 'native value to send');

    addStarknetOptions(executeProposalCmd, { offlineSupport: true });

    executeProposalCmd.action(async (target, entryPointSelector, callData, nativeValue, options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const cmdOptions = {
                ...options,
                target,
                entryPointSelector,
                callData,
                nativeValue,
            };

            const result = await executeProposal(config, { ...chain, name: STARKNET_CHAIN }, cmdOptions);
            console.log(`✅ execute-proposal completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ execute-proposal failed for ${STARKNET_CHAIN}: ${error.message}\n`);
            process.exit(1);
        }
    });

    const executeOperatorProposalCmd = program
        .command('execute-operator-proposal')
        .description('Execute an operator proposal')
        .argument('<target>', 'target contract address')
        .argument('<entryPointSelector>', 'entry point selector (felt252)')
        .argument('<callData>', 'call data as JSON array of felt252')
        .argument('<nativeValue>', 'native value to send');

    addStarknetOptions(executeOperatorProposalCmd, { offlineSupport: true });

    executeOperatorProposalCmd.action(async (target, entryPointSelector, callData, nativeValue, options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const cmdOptions = {
                ...options,
                target,
                entryPointSelector,
                callData,
                nativeValue,
            };

            const result = await executeOperatorProposal(config, { ...chain, name: STARKNET_CHAIN }, cmdOptions);
            console.log(`✅ execute-operator-proposal completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ execute-operator-proposal failed for ${STARKNET_CHAIN}: ${error.message}\n`);
            process.exit(1);
        }
    });

    const withdrawCmd = program
        .command('withdraw')
        .description('Withdraw native tokens from the governance contract')
        .argument('<recipient>', 'recipient address')
        .argument('<amount>', 'amount to withdraw');

    addStarknetOptions(withdrawCmd, { offlineSupport: true });

    withdrawCmd.action(async (recipient, amount, options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const cmdOptions = {
                ...options,
                recipient,
                amount,
            };

            const result = await withdraw(config, { ...chain, name: STARKNET_CHAIN }, cmdOptions);
            console.log(`✅ withdraw completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ withdraw failed for ${STARKNET_CHAIN}: ${error.message}\n`);
            process.exit(1);
        }
    });

    const transferOpCmd = program
        .command('transfer-operatorship')
        .description('Transfer governance operatorship')
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

    program.parse();
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

export {
    governanceChain,
    governanceAddress,
    getProposalEta,
    getTimeLock,
    isOperatorProposalApproved,
    executeProposal,
    executeOperatorProposal,
    withdraw,
    transferOperatorship,
};
