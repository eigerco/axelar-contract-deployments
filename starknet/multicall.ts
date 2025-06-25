'use strict';

import { Command } from 'commander';
import * as fs from 'fs';
import { loadConfig } from '../common';
import { addStarknetOptions } from './cli-utils';
import {
    getStarknetProvider,
    getStarknetAccount,
    handleOfflineTransaction,
    validateStarknetOptions,
    estimateGasAndDisplayArgs
} from './utils';
import { Call, Contract, Account, CallData, num } from 'starknet';
import {
    MulticallConfig,
    MulticallCommandOptions,
    Config,
    ChainConfig
} from './types';

// Constant for Starknet chain name in config
const STARKNET_CHAIN = 'starknet';

/**
 * Load and validate multicall configuration from JSON file
 */
function loadMulticallConfig(configPath: string): MulticallConfig {
    if (!fs.existsSync(configPath)) {
        throw new Error(`Configuration file not found: ${configPath}`);
    }

    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData) as MulticallConfig;

    // Validate configuration
    if (!config.calls || !Array.isArray(config.calls)) {
        throw new Error('Configuration must contain a "calls" array');
    }

    if (config.calls.length === 0) {
        throw new Error('At least one call must be specified in the configuration');
    }

    // Validate each call
    config.calls.forEach((call, index) => {
        if (!call.contract_address) {
            throw new Error(`Call ${index + 1}: missing contract_address`);
        }
        if (!call.entrypoint) {
            throw new Error(`Call ${index + 1}: missing entrypoint`);
        }
        if (!call.calldata || !Array.isArray(call.calldata)) {
            throw new Error(`Call ${index + 1}: calldata must be an array`);
        }
    });

    return config;
}

/**
 * Execute multicall transaction
 */
async function executeMulticall(
    config: Config,
    chain: ChainConfig & { name: string },
    options: MulticallCommandOptions
): Promise<any> {
    const {
        privateKey,
        accountAddress,
        offline,
        estimate
    } = options;

    // Load multicall configuration
    const multicallConfig = loadMulticallConfig(options.config);

    console.log(`\nProcessing multicall with ${multicallConfig.calls.length} calls:`);
    multicallConfig.calls.forEach((call, index) => {
        console.log(`  ${index + 1}. ${call.entrypoint} on ${call.contract_address}`);
    });

    // Convert config calls to starknet Call format with hex calldata
    const calls: Call[] = multicallConfig.calls.map(call => {
        const compiledCalldata = CallData.compile(call.calldata);
        const hexCalldata = compiledCalldata.map(item => num.toHex(item));
        return {
            contractAddress: call.contract_address,
            entrypoint: call.entrypoint,
            calldata: hexCalldata
        };
    });

    const provider = getStarknetProvider(chain);

    // Handle estimate mode
    if (estimate) {
        console.log(`\nEstimating gas for multicall on ${chain.name}...`);
        const account = getStarknetAccount(privateKey!, accountAddress!, provider);
        await estimateGasAndDisplayArgs(account, calls);
        return {};
    }

    // Handle offline mode
    if (offline) {
        return handleOfflineTransaction(options, chain.name, calls, 'multicall');
    }

    // Online execution
    const account = getStarknetAccount(privateKey!, accountAddress!, provider);

    console.log('\nExecuting multicall transaction...');
    const response = await account.execute(calls, {
        version: '0x3'
    });

    console.log(`Transaction sent! Hash: ${response.transaction_hash}`);
    console.log('Waiting for confirmation...');

    await account.waitForTransaction(response.transaction_hash);

    console.log('✅ Multicall transaction confirmed!');
    return response;
}


async function main(): Promise<void> {
    const program = new Command();

    program
        .name('multicall')
        .description('Execute multiple contract calls in a single transaction on Starknet')
        .version('1.0.0')
        .argument('<config>', 'path to multicall configuration JSON file');

    addStarknetOptions(program, { offlineSupport: true });

    program.action(async (configPath, options) => {
        validateStarknetOptions(options.env, options.offline, options.privateKey, options.accountAddress);
        const config = loadConfig(options.env);

        const chain = config.chains[STARKNET_CHAIN];
        if (!chain) {
            throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${options.env}`);
        }

        try {
            const cmdOptions: MulticallCommandOptions = {
                ...options,
                config: configPath
            };

            const result = await executeMulticall(config, { ...chain, name: STARKNET_CHAIN }, cmdOptions);
            console.log(`✅ multicall completed for ${STARKNET_CHAIN}\n`);
        } catch (error: any) {
            console.error(`❌ multicall failed for ${STARKNET_CHAIN}: ${error.message}\n`);
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

export { executeMulticall, loadMulticallConfig };
