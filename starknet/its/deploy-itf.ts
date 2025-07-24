import { Command, Option } from 'commander';
import { loadConfig, saveConfig, prompt } from '../../common';
import { addStarknetOptions } from '../cli-utils';

// Constant for Starknet chain name in config
const STARKNET_CHAIN = 'starknet';
import {
    deployContract,
    getContractConfig,
    saveContractConfig,
    validateStarknetOptions,
    getStarknetAccount,
    getStarknetProvider
} from '../utils';
import { CallData } from 'starknet';
import {
    Config,
    ChainConfig,
    DeployContractOptions,
    OfflineTransactionResult
} from '../types';

interface DeployITFOptions extends DeployContractOptions {
    interchainTokenService?: string;
    owner?: string;
}

async function processCommand(
    config: Config,
    chain: ChainConfig & { name: string },
    options: DeployITFOptions
): Promise<Config | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        interchainTokenService,
        owner,
        salt,
        yes,
        offline,
        env,
        estimate,
    } = options;

    // Validate execution options
    validateStarknetOptions(env, offline, privateKey, accountAddress);

    // Get InterchainTokenFactory class hash from config
    const itfConfig = getContractConfig(config, chain.name, 'InterchainTokenFactory');
    if (!itfConfig.classHash) {
        throw new Error('InterchainTokenFactory class hash not found in config. Please declare the contract first.');
    }
    const classHash = itfConfig.classHash;

    // Get InterchainTokenService address from config first, then option
    const itsConfig = getContractConfig(config, chain.name, 'InterchainTokenService');
    const itsAddress = itsConfig.address || interchainTokenService;
    
    if (!itsAddress) {
        throw new Error('InterchainTokenService address not found. Please deploy the ITS first or provide --interchainTokenService option.');
    }

    // Use provided owner or default to account address
    const ownerAddress = owner || accountAddress;

    // Build constructor calldata for InterchainTokenFactory matching Cairo constructor
    const constructorCalldata = [
        itsAddress,    // interchain_token_service: ContractAddress
        ownerAddress,  // owner: ContractAddress
    ];

    // Display deployment info
    console.log('\nDeploying InterchainTokenFactory:');
    console.log('- InterchainTokenService:', itsAddress);
    console.log('- Owner:', ownerAddress);
    console.log('- Salt:', salt);

    // Handle estimate mode
    if (estimate) {
        console.log(`\nEstimating gas for deploying InterchainTokenFactory on ${chain.name}...`);
        
        // For estimation, we need to simulate the deployment
        console.log('Note: Gas estimation for contract deployment is not directly supported.');
        console.log('Use standard gas limits for deployment transactions.');
        
        return config; // No config changes for estimation
    }

    // Handle offline mode
    if (offline) {
        console.log(`\nOffline deployment is not supported for direct contract deployment.`);
        console.log('Please use online mode for deploying contracts.');
        throw new Error('Offline deployment not supported for this operation');
    }

    // Confirm deployment
    if (!yes && prompt(`Proceed with InterchainTokenFactory deployment on ${chain.name}?`)) {
        console.log('Deployment cancelled');
        return config;
    }

    // Deploy the contract
    const provider = getStarknetProvider(chain);
    const account = getStarknetAccount(privateKey!, accountAddress!, provider);
    
    console.log(`\nDeploying InterchainTokenFactory...`);
    
    // Use the deployContract utility function
    const deploymentResult = await deployContract(account, classHash, constructorCalldata, salt);

    console.log('Transaction hash:', deploymentResult.transactionHash);
    console.log('Contract address:', deploymentResult.contractAddress);

    // Save contract config
    saveContractConfig(
        config,
        chain.name,
        'InterchainTokenFactory',
        {
            address: deploymentResult.contractAddress,
            classHash,
            deploymentTransactionHash: deploymentResult.transactionHash,
            deployer: accountAddress,
            salt,
            deployedAt: new Date().toISOString()
        }
    );

    console.log('\nInterchainTokenFactory deployed successfully!');
    console.log('Address:', deploymentResult.contractAddress);

    // Save the updated config
    saveConfig(config, options.env);

    return config;
}

// Main execution
if (require.main === module) {
    const program = new Command();

    program
        .name('deploy-itf')
        .description('Deploy InterchainTokenFactory contract on Starknet')
        .addOption(new Option('--interchainTokenService <address>', 'InterchainTokenService contract address'))
        .addOption(new Option('--owner <address>', 'Owner address (defaults to account address)'))
        .addOption(new Option('--salt <salt>', 'Salt for deployment (defaults to 0)').default('0'));

    addStarknetOptions(program);

    program.action(async (options) => {
        const config = loadConfig(options.env);
        const chain = config.chains[STARKNET_CHAIN];
        
        if (!chain) {
            throw new Error('Starknet configuration not found');
        }

        await processCommand(config, { ...chain, name: STARKNET_CHAIN }, options);
    });

    program.parse();
}

module.exports = {
    deployITF: processCommand,
};
