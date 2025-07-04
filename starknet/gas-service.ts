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
    GasServiceCommandOptions,
    OfflineTransactionResult
} from './types';

/**
 * Helper function to get gas service contract instance with ABI
 */
async function getGasServiceContract(
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
 * Common function to handle gas estimation for gas service operations
 */
async function handleGasEstimation(
    chain: ChainConfig & { name: string },
    options: GasServiceCommandOptions,
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

async function collect(
    config: Config,
    chain: ChainConfig & { name: string },
    options: GasServiceCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        receiverAddress,
        contractsAmounts,
        offline,
        estimate,
    } = options;

    const provider = getStarknetProvider(chain);

    const gasServiceConfig = getContractConfig(config, chain.name, 'AxelarGasService');
    if (!gasServiceConfig.address) {
        throw new Error('AxelarGasService contract not found in configuration');
    }

    console.log(`Collecting fees to receiver: ${receiverAddress}`);
    console.log(`Number of contracts to collect from: ${contractsAmounts.length}`);

    // Format contracts_amounts as array of tuples (ContractAddress, u256)
    const formattedContractsAmounts = contractsAmounts.map(item => ({
        contract_address: item.contract_address,
        amount: uint256.bnToUint256(item.amount)
    }));

    const calldata = CallData.compile([
        receiverAddress, // ContractAddress
        formattedContractsAmounts // Array<(ContractAddress, u256)>
    ]);

    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, gasServiceConfig.address, 'collect', hexCalldata);
    }

    if (offline) {
        const calls: Call[] = [{
            contractAddress: gasServiceConfig.address,
            entrypoint: 'collect',
            calldata: hexCalldata
        }];
        return handleOfflineTransaction(options, chain.name, calls, 'collect');
    }

    // Online execution
    const account = getStarknetAccount(privateKey, accountAddress, provider);
    const gasServiceContract = await getGasServiceContract(provider, gasServiceConfig.address, account);

    const response = await gasServiceContract.collect(calldata);
    await account.waitForTransaction(response.transaction_hash);

    console.log(`Fees collected successfully!`);
    console.log(`Transaction Hash: ${response.transaction_hash}`);

    return response;
}

async function refund(
    config: Config,
    chain: ChainConfig & { name: string },
    options: GasServiceCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        txHash,
        logIndex,
        receiverAddress,
        tokenAddress,
        amount,
        offline,
        estimate,
    } = options;

    const provider = getStarknetProvider(chain);

    const gasServiceConfig = getContractConfig(config, chain.name, 'AxelarGasService');
    if (!gasServiceConfig.address) {
        throw new Error('AxelarGasService contract not found in configuration');
    }

    console.log(`Refunding tokens`);
    console.log(`Transaction Hash: ${txHash}`);
    console.log(`Log Index: ${logIndex}`);
    console.log(`Receiver: ${receiverAddress}`);
    console.log(`Token: ${tokenAddress}`);
    console.log(`Amount: ${amount}`);

    const calldata = CallData.compile([
        txHash, // felt252
        logIndex, // u64
        receiverAddress, // ContractAddress
        tokenAddress, // ContractAddress
        uint256.bnToUint256(amount) // u256
    ]);

    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, gasServiceConfig.address, 'refund', hexCalldata);
    }

    if (offline) {
        const calls: Call[] = [{
            contractAddress: gasServiceConfig.address,
            entrypoint: 'refund',
            calldata: hexCalldata
        }];
        return handleOfflineTransaction(options, chain.name, calls, 'refund');
    }

    // Online execution
    const account = getStarknetAccount(privateKey, accountAddress, provider);
    const gasServiceContract = await getGasServiceContract(provider, gasServiceConfig.address, account);

    const response = await gasServiceContract.refund(calldata);
    await account.waitForTransaction(response.transaction_hash);

    console.log(`Refund successful!`);
    console.log(`Transaction Hash: ${response.transaction_hash}`);

    return response;
}

async function addGasForGmpContractCall(
    config: Config,
    chain: ChainConfig & { name: string },
    options: GasServiceCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        txHash,
        logIndex,
        tokenAddress,
        refundAddress,
        amount,
        offline,
        estimate,
    } = options;

    const provider = getStarknetProvider(chain);

    const gasServiceConfig = getContractConfig(config, chain.name, 'AxelarGasService');
    if (!gasServiceConfig.address) {
        throw new Error('AxelarGasService contract not found in configuration');
    }

    console.log(`Adding gas for GMP contract call`);
    console.log(`Transaction Hash: ${txHash}`);
    console.log(`Log Index: ${logIndex}`);
    console.log(`Token: ${tokenAddress}`);
    console.log(`Refund Address: ${refundAddress}`);
    console.log(`Amount: ${amount}`);

    const calldata = CallData.compile([
        txHash, // felt252
        logIndex, // u64
        tokenAddress, // ContractAddress
        refundAddress, // ContractAddress
        uint256.bnToUint256(amount) // u256
    ]);

    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, gasServiceConfig.address, 'add_gas_for_gmp_contract_call', hexCalldata);
    }

    if (offline) {
        const calls: Call[] = [{
            contractAddress: gasServiceConfig.address,
            entrypoint: 'add_gas_for_gmp_contract_call',
            calldata: hexCalldata
        }];
        return handleOfflineTransaction(options, chain.name, calls, 'add_gas_for_gmp_contract_call');
    }

    // Online execution
    const account = getStarknetAccount(privateKey, accountAddress, provider);
    const gasServiceContract = await getGasServiceContract(provider, gasServiceConfig.address, account);

    const response = await gasServiceContract.add_gas_for_gmp_contract_call(calldata);
    await account.waitForTransaction(response.transaction_hash);

    console.log(`Gas added successfully!`);
    console.log(`Transaction Hash: ${response.transaction_hash}`);

    return response;
}

async function payGasForGmpContractCall(
    config: Config,
    chain: ChainConfig & { name: string },
    options: GasServiceCommandOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        destinationChain,
        destinationAddress,
        payloadHash,
        tokenAddress,
        refundAddress,
        amount,
        params,
        offline,
        estimate,
    } = options;

    const provider = getStarknetProvider(chain);

    const gasServiceConfig = getContractConfig(config, chain.name, 'AxelarGasService');
    if (!gasServiceConfig.address) {
        throw new Error('AxelarGasService contract not found in configuration');
    }

    console.log(`Paying gas for GMP contract call`);
    console.log(`Destination Chain: ${destinationChain}`);
    console.log(`Destination Address: ${destinationAddress}`);
    console.log(`Payload Hash: ${payloadHash}`);
    console.log(`Token: ${tokenAddress}`);
    console.log(`Refund Address: ${refundAddress}`);
    console.log(`Amount: ${amount}`);
    console.log(`Params: ${params}`);

    const calldata = CallData.compile([
        destinationChain, // felt252
        byteArray.byteArrayFromString(destinationAddress), // ByteArray
        uint256.bnToUint256(payloadHash), // u256
        tokenAddress, // ContractAddress
        refundAddress, // ContractAddress
        uint256.bnToUint256(amount), // u256
        byteArray.byteArrayFromString(params) // ByteArray
    ]);

    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        return handleGasEstimation(chain, options, gasServiceConfig.address, 'pay_gas_for_gmp_contract_call', hexCalldata);
    }

    if (offline) {
        const calls: Call[] = [{
            contractAddress: gasServiceConfig.address,
            entrypoint: 'pay_gas_for_gmp_contract_call',
            calldata: hexCalldata
        }];
        return handleOfflineTransaction(options, chain.name, calls, 'pay_gas_for_gmp_contract_call');
    }

    // Online execution
    const account = getStarknetAccount(privateKey, accountAddress, provider);
    const gasServiceContract = await getGasServiceContract(provider, gasServiceConfig.address, account);

    const response = await gasServiceContract.pay_gas_for_gmp_contract_call(calldata);
    await account.waitForTransaction(response.transaction_hash);

    console.log(`Gas payment successful!`);
    console.log(`Transaction Hash: ${response.transaction_hash}`);

    return response;
}

// ########## Main Function ##########

export async function main(options: GasServiceCommandOptions) {
    const config = loadConfig(options.env);
    const chain = config.chains[STARKNET_CHAIN];

    if (!chain) {
        throw new Error(`Chain configuration for ${STARKNET_CHAIN} not found`);
    }

    const chainConfig = { ...chain, name: STARKNET_CHAIN };

    if (options.action === 'collect') {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress);
        return await collect(config, chainConfig, options);
    } else if (options.action === 'refund') {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress);
        return await refund(config, chainConfig, options);
    } else if (options.action === 'addGasForGmpContractCall') {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress);
        return await addGasForGmpContractCall(config, chainConfig, options);
    } else if (options.action === 'payGasForGmpContractCall') {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress);
        return await payGasForGmpContractCall(config, chainConfig, options);
    } else {
        throw new Error(`Invalid action: ${options.action}`);
    }
}

// ########## CLI Setup ##########

if (require.main === module) {
    const program = new Command();

    program
        .name('gas-service')
        .description('Interact with the Axelar Gas Service contract on Starknet');

    // Collect command
    const collectCmd = program
        .command('collect')
        .description('Collect accumulated fees from the contract')
        .requiredOption('--receiverAddress <address>', 'The address to receive the collected tokens')
        .requiredOption('--contractsAmounts <json>', 'JSON array of contracts and amounts [{contract_address, amount}]', (value) => {
            try {
                return JSON.parse(value);
            } catch (e) {
                throw new Error('Invalid JSON for contractsAmounts');
            }
        })
        .action(async (options) => {
            await main({ ...options, action: 'collect' });
        });
    addStarknetOptions(collectCmd);

    // Refund command
    const refundCmd = program
        .command('refund')
        .description('Refund tokens to a receiver address')
        .requiredOption('--txHash <hash>', 'The transaction hash of the refund')
        .requiredOption('--logIndex <index>', 'The log index in the event', (value) => parseInt(value, 10))
        .requiredOption('--receiverAddress <address>', 'The address to receive the refund')
        .requiredOption('--tokenAddress <address>', 'The ERC20 token contract address to refund')
        .requiredOption('--amount <amount>', 'The amount of tokens to refund')
        .action(async (options) => {
            await main({ ...options, action: 'refund' });
        });
    addStarknetOptions(refundCmd);

    // Add gas for GMP contract call command
    const addGasCmd = program
        .command('add-gas')
        .description('Add additional gas payment for GMP contract call')
        .requiredOption('--txHash <hash>', 'The transaction hash of the GMP call')
        .requiredOption('--logIndex <index>', 'The log index in the transaction', (value) => parseInt(value, 10))
        .requiredOption('--tokenAddress <address>', 'The ERC20 token address used for gas payment')
        .requiredOption('--refundAddress <address>', 'The address to refund unused gas to')
        .requiredOption('--amount <amount>', 'The amount of tokens to add for gas')
        .action(async (options) => {
            await main({ ...options, action: 'addGasForGmpContractCall' });
        });
    addStarknetOptions(addGasCmd);

    // Pay gas for GMP contract call command
    const payGasCmd = program
        .command('pay-gas')
        .description('Pay for gas for a GMP contract call')
        .requiredOption('--destinationChain <chain>', 'The destination chain identifier')
        .requiredOption('--destinationAddress <address>', 'The address on the destination chain')
        .requiredOption('--payloadHash <hash>', 'Hash of the payload being sent')
        .requiredOption('--tokenAddress <address>', 'Address of the ERC20 token being used to pay for gas')
        .requiredOption('--refundAddress <address>', 'Address to refund gas payments to')
        .requiredOption('--amount <amount>', 'Amount of tokens to use for gas payment')
        .requiredOption('--params <params>', 'Additional parameters for the gas payment')
        .action(async (options) => {
            await main({ ...options, action: 'payGasForGmpContractCall' });
        });
    addStarknetOptions(payGasCmd);

    program.parse();
}
