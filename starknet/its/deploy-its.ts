
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
import { byteArray, CallData } from 'starknet';
import {
    Config,
    ChainConfig,
    DeployContractOptions,
    OfflineTransactionResult
} from '../types';

interface DeployITSOptions extends DeployContractOptions {
    gateway?: string;
    gasService?: string;
    chainName?: string;
    interchainToken?: string;
    tokenManager?: string;
    tokenHandler?: string;
    universalDeployer?: string;
    itsHubChainName?: string;
    itsHubContractAddress?: string;
    operator?: string;
    owner?: string;
}

async function processCommand(
    config: Config,
    chain: ChainConfig & { name: string },
    options: DeployITSOptions
): Promise<Config | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        gateway,
        gasService,
        chainName,
        interchainToken,
        tokenManager,
        tokenHandler,
        universalDeployer,
        itsHubChainName,
        itsHubContractAddress,
        operator,
        owner,
        salt,
        yes,
        offline,
        env,
        estimate,
    } = options;

    // Validate execution options
    validateStarknetOptions(env, offline, privateKey, accountAddress);

    // Get InterchainTokenService class hash from config
    const itsConfig = getContractConfig(config, chain.name, 'InterchainTokenService');
    if (!itsConfig.classHash) {
        throw new Error('InterchainTokenService class hash not found in config. Please declare the contract first.');
    }
    const classHash = itsConfig.classHash;


    // Get gateway and gas service addresses
    const gatewayAddress = gateway || getContractConfig(config, chain.name, 'AxelarGateway').address;
    const gasServiceAddress = gasService || getContractConfig(config, chain.name, 'AxelarGasService').address;

    if (!gatewayAddress) {
        throw new Error('AxelarGateway address not found. Please deploy the gateway first or provide --gateway option.');
    }

    if (!gasServiceAddress) {
        throw new Error('AxelarGasService address not found. Please deploy the gas service first or provide --gasService option.');
    }

    // Get contract class hashes
    const interchainTokenClassHash = interchainToken || getContractConfig(config, chain.name, 'InterchainToken').classHash;
    const tokenManagerClassHash = tokenManager || getContractConfig(config, chain.name, 'TokenManager').classHash;
    const tokenHandlerClassHash = tokenHandler || getContractConfig(config, chain.name, 'TokenHandler').classHash;

    // Validate required class hashes
    if (!interchainTokenClassHash) {
        throw new Error('InterchainToken class hash not found. Please declare the contract first or provide --interchainToken option.');
    }
    if (!tokenManagerClassHash) {
        throw new Error('TokenManager class hash not found. Please declare the contract first or provide --tokenManager option.');
    }
    if (!tokenHandlerClassHash) {
        throw new Error('TokenHandler class hash not found. Please declare the contract first or provide --tokenHandler option.');
    }

    // Get universal deployer address
    const universalDeployerAddress = universalDeployer || chain.universalDeployerAddress;
    if (!universalDeployerAddress) {
        throw new Error('Universal Deployer address not found. Please provide --universalDeployer option or configure it in chain config.');
    }

    // Use provided addresses or defaults
    const operatorAddress = operator || accountAddress;
    const ownerAddress = owner || accountAddress;

    // ITS hub configuration
    const hubChainName = itsHubChainName || 'axelar';

    if (!itsHubContractAddress) {
        throw new Error('ITS hub contract address is required. Please provide --itsHubContractAddress option.');
    }
    const hubContractAddress = itsHubContractAddress;

    // Use provided chain name or get from config
    const itsChainName = chainName || chain.name;

    // Build constructor calldata for InterchainTokenService matching Cairo constructor
    const constructorCalldata = [
        gatewayAddress,                                     // gateway: ContractAddress
        gasServiceAddress,                                  // gas_service: ContractAddress
        itsChainName,                                       // chain_name: felt252
        interchainTokenClassHash,                           // interchain_token_class_hash: ClassHash
        tokenManagerClassHash,                              // token_manager_class_hash: ClassHash
        tokenHandlerClassHash,                              // token_handler_class_hash: ClassHash
        universalDeployerAddress,                           // universal_deployer: ContractAddress
        hubChainName,                                       // its_hub_chain_name: felt252
        byteArray.byteArrayFromString(hubContractAddress),  // its_hub_contract_address: ByteArray
        operatorAddress,                                    // operator: ContractAddress
        ownerAddress,                                       // owner: ContractAddress
    ];

    // Display deployment info
    console.log('\nDeploying InterchainTokenService:');
    console.log('- Gateway:', gatewayAddress);
    console.log('- Gas Service:', gasServiceAddress);
    console.log('- Chain Name:', itsChainName);
    console.log('- Universal Deployer:', universalDeployerAddress);
    console.log('- ITS Hub Chain:', hubChainName);
    console.log('- ITS Hub Address:', hubContractAddress);
    console.log('- Operator:', operatorAddress);
    console.log('- Owner:', ownerAddress);
    console.log('- Salt:', salt);

    // Handle estimate mode
    if (estimate) {
        console.log(`\nEstimating gas for deploying InterchainTokenService on ${chain.name}...`);

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
    if (!yes && prompt(`Proceed with InterchainTokenService deployment on ${chain.name}?`)) {
        console.log('Deployment cancelled');
        return config;
    }

    // Deploy the contract
    const provider = getStarknetProvider(chain);
    const account = getStarknetAccount(privateKey!, accountAddress!, provider);

    console.log(`\nDeploying InterchainTokenService...`);

    // Use the deployContract utility function
    const deploymentResult = await deployContract(account, classHash, constructorCalldata, salt);

    console.log('Transaction hash:', deploymentResult.transactionHash);
    console.log('Contract address:', deploymentResult.contractAddress);

    // Save contract config
    saveContractConfig(
        config,
        chain.name,
        'InterchainTokenService',
        {
            address: deploymentResult.contractAddress,
            classHash,
            deploymentTransactionHash: deploymentResult.transactionHash,
            deployer: accountAddress,
            salt,
            deployedAt: new Date().toISOString()
        }
    );

    console.log('\nInterchainTokenService deployed successfully!');
    console.log('Address:', deploymentResult.contractAddress);

    // Save the updated config
    saveConfig(config, options.env);

    return config;
}

// Main execution
if (require.main === module) {
    const program = new Command();

    program
        .name('deploy-its')
        .description('Deploy InterchainTokenService contract on Starknet')
        .addOption(new Option('--gateway <address>', 'AxelarGateway contract address'))
        .addOption(new Option('--gasService <address>', 'AxelarGasService contract address'))
        .addOption(new Option('--chainName <name>', 'Chain name for ITS (defaults to chain name from config)'))
        .addOption(new Option('--interchainToken <classHash>', 'InterchainToken class hash'))
        .addOption(new Option('--tokenManager <classHash>', 'TokenManager class hash'))
        .addOption(new Option('--tokenHandler <classHash>', 'TokenHandler class hash'))
        .addOption(new Option('--universalDeployer <address>', 'Universal Deployer contract address'))
        .addOption(new Option('--itsHubChainName <name>', 'ITS hub chain name (defaults to "axelar")'))
        .addOption(new Option('--itsHubContractAddress <address>', 'ITS hub contract address (required)'))
        .addOption(new Option('--operator <address>', 'Operator address (defaults to account address)'))
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
    deployITS: processCommand,
};
