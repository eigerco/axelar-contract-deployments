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
import { uint256, num, Contract, CallData, Call, Provider, Account, selector } from 'starknet';
import {
    Config,
    ChainConfig,
    OperatorsCommandOptions,
    OfflineTransactionResult
} from './types';

/**
 * Helper function to get operators contract instance with ABI
 */
async function getOperatorsContract(
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
 * Common function to handle gas estimation for operators operations
 */
async function handleGasEstimation(
    chain: ChainConfig & { name: string },
    options: OperatorsCommandOptions,
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

async function isOperator(
    config: Config,
    chain: ChainConfig & { name: string },
    options: OperatorsCommandOptions
): Promise<boolean> {
    const { account } = options;

    const provider = getStarknetProvider(chain);

    const operatorsConfig = getContractConfig(config, chain.name, 'Operators');
    if (!operatorsConfig.address) {
        throw new Error('Operators contract not found in configuration');
    }

    const operatorsContract = await getOperatorsContract(provider, operatorsConfig.address);

    const calldata = CallData.compile([account]);

    const result = await operatorsContract.is_operator(calldata);

    console.log(`Account ${account} is operator: ${result}`);
    return result;
}

async function addOperator(
    config: Config,
    chain: ChainConfig & { name: string },
    options: OperatorsCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        operator,
        offline,
        estimate,
    } = options;

    const operatorsConfig = getContractConfig(config, chain.name, 'Operators');
    if (!operatorsConfig.address) {
        throw new Error('Operators contract not found in configuration');
    }

    console.log(`Adding operator: ${operator}`);

    const calldata = CallData.compile([operator]);
    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, operatorsConfig.address, 'add_operator', hexCalldata);
    }

    if (offline) {
        const calls: Call[] = [{
            contractAddress: operatorsConfig.address,
            entrypoint: 'add_operator',
            calldata: hexCalldata
        }];
        return handleOfflineTransaction(options, chain.name, calls, 'add_operator');
    }

    // Online execution
    const provider = getStarknetProvider(chain);
    const account = getStarknetAccount(privateKey, accountAddress, provider);
    const operatorsContract = await getOperatorsContract(provider, operatorsConfig.address, account);

    const response = await operatorsContract.add_operator(calldata);
    await account.waitForTransaction(response.transaction_hash);

    console.log(`Operator added successfully!`);
    console.log(`Transaction Hash: ${response.transaction_hash}`);

    return response;
}

async function removeOperator(
    config: Config,
    chain: ChainConfig & { name: string },
    options: OperatorsCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        operator,
        offline,
        estimate,
    } = options;

    const operatorsConfig = getContractConfig(config, chain.name, 'Operators');
    if (!operatorsConfig.address) {
        throw new Error('Operators contract not found in configuration');
    }

    console.log(`Removing operator: ${operator}`);

    const calldata = CallData.compile([operator]);
    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, operatorsConfig.address, 'remove_operator', hexCalldata);
    }

    if (offline) {
        const calls: Call[] = [{
            contractAddress: operatorsConfig.address,
            entrypoint: 'remove_operator',
            calldata: hexCalldata
        }];
        return handleOfflineTransaction(options, chain.name, calls, 'remove_operator');
    }

    // Online execution
    const provider = getStarknetProvider(chain);
    const account = getStarknetAccount(privateKey, accountAddress, provider);
    const operatorsContract = await getOperatorsContract(provider, operatorsConfig.address, account);

    const response = await operatorsContract.remove_operator(calldata);
    await account.waitForTransaction(response.transaction_hash);

    console.log(`Operator removed successfully!`);
    console.log(`Transaction Hash: ${response.transaction_hash}`);

    return response;
}

async function executeContract(
    config: Config,
    chain: ChainConfig & { name: string },
    options: OperatorsCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        target,
        functionName,
        calldata: inputCalldata,
        nativeValue,
        offline,
        estimate,
    } = options;

    const operatorsConfig = getContractConfig(config, chain.name, 'Operators');
    if (!operatorsConfig.address) {
        throw new Error('Operators contract not found in configuration');
    }

    // Calculate the entrypoint selector from the function name
    const entryPointSelector = selector.getSelectorFromName(functionName!);

    console.log(`Executing contract call:`);
    console.log(`Target: ${target}`);
    console.log(`Function Name: ${functionName}`);
    console.log(`Entry Point Selector: ${entryPointSelector}`);
    console.log(`Calldata: ${inputCalldata}`);
    console.log(`Native Value: ${nativeValue}`);

    // Parse the calldata array if it's a string
    let parsedCalldata = inputCalldata;
    if (typeof inputCalldata === 'string') {
        parsedCalldata = JSON.parse(inputCalldata);
    }

    // Compile the calldata for execute_contract
    const calldata = CallData.compile([
        target,                                    // ContractAddress
        entryPointSelector,                        // felt252
        parsedCalldata,                           // Span<felt252>
        uint256.bnToUint256(nativeValue || '0')  // u256
    ]);

    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, operatorsConfig.address, 'execute_contract', hexCalldata);
    }

    if (offline) {
        const calls: Call[] = [{
            contractAddress: operatorsConfig.address,
            entrypoint: 'execute_contract',
            calldata: hexCalldata
        }];
        return handleOfflineTransaction(options, chain.name, calls, 'execute_contract');
    }

    // Online execution
    const provider = getStarknetProvider(chain);
    const account = getStarknetAccount(privateKey, accountAddress, provider);
    const operatorsContract = await getOperatorsContract(provider, operatorsConfig.address, account);

    const response = await operatorsContract.execute_contract(calldata);
    await account.waitForTransaction(response.transaction_hash);

    console.log(`Contract execution completed!`);
    console.log(`Transaction Hash: ${response.transaction_hash}`);

    return response;
}

async function main(): Promise<void> {
    const program = new Command();

    program
        .name('operators')
        .description('Interact with Operators contract on Starknet')
        .version('1.0.0');

    // Query command - is-operator
    const isOperatorCmd = program
        .command('is-operator')
        .description('Check if an account is an operator')
        .argument('<account>', 'account address to check');

    addStarknetOptions(isOperatorCmd, { ignorePrivateKey: true, ignoreAccountAddress: true });

    isOperatorCmd.action(async (account, options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress, false);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const cmdOptions = {
                ...options,
                account,
            };

            const result = await isOperator(config, { ...chain, name: STARKNET_CHAIN }, cmdOptions);
            console.log(`✅ is-operator completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ is-operator failed for ${STARKNET_CHAIN}: ${error.message}\n`);
            process.exit(1);
        }
    });

    // Add operator command
    const addOperatorCmd = program
        .command('add-operator')
        .description('Add a new operator')
        .argument('<operator>', 'operator address to add');

    addStarknetOptions(addOperatorCmd, { offlineSupport: true });

    addOperatorCmd.action(async (operator, options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const cmdOptions = {
                ...options,
                operator,
            };

            const result = await addOperator(config, { ...chain, name: STARKNET_CHAIN }, cmdOptions);
            console.log(`✅ add-operator completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ add-operator failed for ${STARKNET_CHAIN}: ${error.message}\n`);
            process.exit(1);
        }
    });

    // Remove operator command
    const removeOperatorCmd = program
        .command('remove-operator')
        .description('Remove an operator')
        .argument('<operator>', 'operator address to remove');

    addStarknetOptions(removeOperatorCmd, { offlineSupport: true });

    removeOperatorCmd.action(async (operator, options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const cmdOptions = {
                ...options,
                operator,
            };

            const result = await removeOperator(config, { ...chain, name: STARKNET_CHAIN }, cmdOptions);
            console.log(`✅ remove-operator completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ remove-operator failed for ${STARKNET_CHAIN}: ${error.message}\n`);
            process.exit(1);
        }
    });

    // Execute contract command
    const executeCmd = program
        .command('execute-contract')
        .description('Execute an external contract call')
        .argument('<target>', 'target contract address')
        .argument('<functionName>', 'function name to call')
        .argument('<calldata>', 'calldata array as JSON string')
        .argument('<nativeValue>', 'native value to send (u256)');

    addStarknetOptions(executeCmd, { offlineSupport: true });

    executeCmd.action(async (target, functionName, calldata, nativeValue, options) => {
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
                functionName,
                calldata,
                nativeValue,
            };

            const result = await executeContract(config, { ...chain, name: STARKNET_CHAIN }, cmdOptions);
            console.log(`✅ execute-contract completed for ${STARKNET_CHAIN}\n`);
        } catch (error) {
            console.error(`❌ execute-contract failed for ${STARKNET_CHAIN}: ${error.message}\n`);
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
    isOperator,
    addOperator,
    removeOperator,
    executeContract,
};

