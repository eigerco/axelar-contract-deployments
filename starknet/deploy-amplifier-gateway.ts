import { Command } from 'commander';
import { loadConfig, saveConfig, prompt, getDomainSeparator } from '../common';
import { addStarknetOptions } from './cli-utils';
import { uint256 } from 'starknet';

// Constant for Starknet chain name in config
const STARKNET_CHAIN = 'starknet';
import {
    deployContract,
    getContractConfig,
    saveContractConfig,
    handleOfflineTransaction,
    validateStarknetOptions,
    getStarknetAccount,
    getStarknetProvider,
    estimateGasAndDisplayArgs
} from './utils';
import { CallData, Call } from 'starknet';
import {
    Config,
    ChainConfig,
    DeployContractOptions,
    OfflineTransactionResult
} from './types';

interface GatewayDeployOptions extends DeployContractOptions {
    previousSignersRetention?: string;
    minimumRotationDelay?: string;
    domainSeparator: string;
    owner: string;
    operator?: string;
}

async function processCommand(
    config: Config,
    chain: ChainConfig & { name: string },
    options: GatewayDeployOptions
): Promise<Config | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        contractConfigName,
        salt,
        yes,
        offline,
        env,
        estimate,
        previousSignersRetention,
        minimumRotationDelay,
        domainSeparator,
        owner,
        operator,
    } = options;

    // Validate execution options
    validateStarknetOptions(env, offline, privateKey, accountAddress);

    // Get class hash from config
    const contractConfig = getContractConfig(config, chain.name, contractConfigName!);
    if (!contractConfig.classHash) {
        throw new Error(`Class hash not found in config for ${contractConfigName}. Please declare the contract first.`);
    }
    const classHash = contractConfig.classHash;

    // Get Universal Deployer Address from config
    const universalDeployerAddress = chain.universalDeployerAddress;
    if (!universalDeployerAddress) {
        throw new Error('Universal Deployer Address not found in chain configuration');
    }

    // Get domain separator (supports 'offline' calculation or manual hex input)
    const domainSeparatorHex = await getDomainSeparator(config, chain, options);

    // Convert hex string to decimal for u256 parameter
    const domainSeparatorDecimal = BigInt(domainSeparatorHex).toString();

    // Build constructor calldata for Gateway
    const constructorCalldata = [];

    // previous_signers_retention: felt252 (default: 15)
    constructorCalldata.push(previousSignersRetention || '15');

    // minimum_rotation_delay: u64 (default: 86400)
    constructorCalldata.push(minimumRotationDelay || '86400');

    // domain_separator: u256 - needs to be split into low and high
    const domainSeparatorBN = BigInt(domainSeparatorDecimal);
    const domainSeparatorU256 = uint256.bnToUint256(domainSeparatorBN);
    constructorCalldata.push(domainSeparatorU256.low);
    constructorCalldata.push(domainSeparatorU256.high);

    // owner: ContractAddress
    constructorCalldata.push(owner);

    // operator: Option<ContractAddress>
    if (operator) {
        // Some variant (1)
        constructorCalldata.push('1');
        constructorCalldata.push(operator);
    } else {
        // None variant (0)
        constructorCalldata.push('0');
    }

    // Build deployment calldata for universal deployer
    const deployCalldata = CallData.compile([
        classHash,
        salt,
        true, // origin dependant deployment
        constructorCalldata,
    ]);

    // Handle estimate mode
    if (estimate) {
        console.log(`\nEstimating gas for deploying ${contractConfigName} on ${chain.name}...`);

        // Initialize provider and account for estimation
        const provider = getStarknetProvider(chain);
        const account = getStarknetAccount(privateKey!, accountAddress!, provider);

        const calls = [{
            contractAddress: universalDeployerAddress,
            entrypoint: 'deployContract',
            calldata: deployCalldata
        }];

        // Estimate gas and display CLI args
        await estimateGasAndDisplayArgs(account, calls);

        return config; // No config changes for estimation
    }

    // Handle offline mode
    if (offline) {
        console.log(`\nGenerating unsigned transaction for deploying ${contractConfigName} on ${chain.name}...`);

        const targetContractAddress = universalDeployerAddress;
        const entrypoint = 'deployContract';

        // Use common offline transaction handler
        const operationName = `deploy_${contractConfigName}`;
        const calls: Call[] = [{
            contractAddress: targetContractAddress,
            entrypoint,
            calldata: deployCalldata
        }];
        return handleOfflineTransaction(options, chain.name, calls, operationName);
    }

    console.log(`\nDeploying ${contractConfigName} on ${chain.name}...`);

    // Initialize account for online operations
    const provider = getStarknetProvider(chain);
    const account = getStarknetAccount(privateKey!, accountAddress!, provider);

    if (!yes) {
        const shouldCancel = prompt(`Deploy ${contractConfigName} with class hash ${classHash}?`);
        if (shouldCancel) {
            console.log('Deployment cancelled.');
            process.exit(1);
        }
    }

    console.log(`Deploying contract ${contractConfigName}...`);
    const deployResult = await deployContract(account, classHash, constructorCalldata, salt);

    console.log(`Contract deployed successfully!`);
    console.log(`Contract Address: ${deployResult.contractAddress}`);
    console.log(`Transaction Hash: ${deployResult.transactionHash}`);
    console.log(`Class Hash: ${deployResult.classHash}`);

    // Save deployment info to config
    saveContractConfig(config, chain.name, contractConfigName!, {
        address: deployResult.contractAddress,
        deploymentTransactionHash: deployResult.transactionHash,
        deployer: accountAddress,
        salt,
        deployedAt: new Date().toISOString(),
    });

    return config;
}

async function main(): Promise<void> {
    const program = new Command();

    program
        .name('deploy-amplifier-gateway')
        .description('Deploy Amplifier Gateway contract on Starknet')
        .version('1.0.0');

    addStarknetOptions(program, {
        deployment: true,
        offlineSupport: true,
    });

    // Add Gateway-specific constructor parameters as CLI options
    program
        .option('--previousSignersRetention <value>', 'Previous signers retention value (default: 15)', '15')
        .option('--minimumRotationDelay <seconds>', 'Minimum rotation delay in seconds (default: 86400 for mainnet, varies by network)', '86400')
        .requiredOption('--domainSeparator <value>', 'Domain separator (keccak256 hash or "offline" for automatic calculation)')
        .requiredOption('--owner <address>', 'Owner contract address')
        .option('--operator <address>', 'Operator contract address (optional)');

    program.parse();

    const options = program.opts() as GatewayDeployOptions;
    const { env } = options;

    // Validate execution options
    validateStarknetOptions(env, options.offline, options.privateKey, options.accountAddress);

    const config = loadConfig(env);
    const chain = config.chains[STARKNET_CHAIN];

    if (!chain) {
        throw new Error(`Chain ${STARKNET_CHAIN} not found in environment ${env}`);
    }

    try {
        const result = await processCommand(config, { ...chain, name: STARKNET_CHAIN }, options);

        // Only save config if we got a config back (not an offline transaction)
        if ('chains' in result) {
            saveConfig(result, env);
            console.log('Configuration updated successfully.');
        }

        console.log(`✅ Deployment completed for ${STARKNET_CHAIN}\n`);
    } catch (error) {
        console.error(`❌ Deployment failed for ${STARKNET_CHAIN}: ${error.message}\n`);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

export {
    processCommand,
};

