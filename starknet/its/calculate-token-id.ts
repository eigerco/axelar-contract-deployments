import { Command } from 'commander';
import { loadConfig } from '../../common';
import { addStarknetOptions } from '../cli-utils';

// Constant for Starknet chain name in config
const STARKNET_CHAIN = 'starknet';
import {
    getStarknetProvider,
    getContractConfig,
} from '../utils';
import { Contract } from 'starknet';
import {
    Config,
    ChainConfig,
} from '../types';

interface CalculateTokenIdOptions {
    type: 'interchain' | 'canonical' | 'linked';
    deployer?: string;
    salt?: string;
    tokenAddress?: string;
    env?: string;
    itsAddress?: string;
    factoryAddress?: string;
}

/**
 * Helper function to get contract instance with ABI
 */
async function getContractWithABI(
    provider: any,
    address: string
): Promise<Contract> {
    const { abi } = await provider.getClassAt(address);
    const contract = new Contract(abi, address, provider);
    return contract;
}

async function processCommand(
    config: Config,
    chain: ChainConfig & { name: string },
    options: CalculateTokenIdOptions
): Promise<void> {
    const {
        type,
        deployer,
        salt,
        tokenAddress,
        itsAddress,
        factoryAddress,
    } = options;

    const provider = getStarknetProvider(chain);

    console.log(`\nCalculating Token ID:`);
    console.log(`- Type: ${type}`);

    let tokenId: string | null = null;

    switch (type) {
        case 'interchain': {
            if (!deployer || !salt) {
                throw new Error('Deployer and salt are required for interchain token ID calculation');
            }

            console.log(`- Deployer: ${deployer}`);
            console.log(`- Salt: ${salt}`);

            // Get ITS address
            const itsContractAddress = itsAddress || getContractConfig(config, chain.name, 'InterchainTokenService').address;
            if (!itsContractAddress) {
                throw new Error('InterchainTokenService contract not found. Provide --itsAddress or deploy ITS first.');
            }

            const itsContract = await getContractWithABI(provider, itsContractAddress);
            
            console.log('\nCalculating interchain token ID...');
            tokenId = await itsContract.interchain_token_id(deployer, salt);
            
            break;
        }

        case 'canonical': {
            if (!tokenAddress) {
                throw new Error('Token address is required for canonical token ID calculation');
            }

            console.log(`- Token Address: ${tokenAddress}`);

            // Get factory address
            const tokenFactoryAddress = factoryAddress || getContractConfig(config, chain.name, 'InterchainTokenFactory').address;
            if (!tokenFactoryAddress) {
                throw new Error('InterchainTokenFactory contract not found. Provide --factoryAddress or deploy factory first.');
            }

            const factoryContract = await getContractWithABI(provider, tokenFactoryAddress);
            
            console.log('\nCalculating canonical token ID...');
            tokenId = await factoryContract.canonical_interchain_token_id(tokenAddress);
            
            break;
        }

        case 'linked': {
            if (!deployer || !salt) {
                throw new Error('Deployer and salt are required for linked token ID calculation');
            }

            console.log(`- Deployer: ${deployer}`);
            console.log(`- Salt: ${salt}`);

            // Get factory address
            const tokenFactoryAddress = factoryAddress || getContractConfig(config, chain.name, 'InterchainTokenFactory').address;
            if (!tokenFactoryAddress) {
                throw new Error('InterchainTokenFactory contract not found. Provide --factoryAddress or deploy factory first.');
            }

            const factoryContract = await getContractWithABI(provider, tokenFactoryAddress);
            
            console.log('\nCalculating linked token ID...');
            tokenId = await factoryContract.linked_token_id(deployer, salt);
            
            break;
        }

        default:
            throw new Error(`Invalid type: ${type}`);
    }

    console.log('\n=== RESULT ===');
    console.log(`Token ID: ${tokenId}`);
    
    // Also display in different formats
    if (tokenId !== null) {
        const nonNullTokenId = tokenId as any; // Type assertion to handle the complex type
        if (typeof nonNullTokenId === 'object' && 'low' in nonNullTokenId && 'high' in nonNullTokenId) {
            // Handle uint256 object
            const hex = '0x' + nonNullTokenId.high.toString(16).padStart(32, '0') + nonNullTokenId.low.toString(16).padStart(32, '0');
            console.log(`Hex format: ${hex}`);
        } else if (typeof nonNullTokenId === 'string' && !nonNullTokenId.startsWith('0x')) {
            // If it's a decimal string, also show hex
            const bigIntValue = BigInt(nonNullTokenId);
            console.log(`Hex format: 0x${bigIntValue.toString(16)}`);
        }
    }

    console.log('\nThis token ID is deterministic and will be the same across all chains');
    console.log('for the same parameters.');
}

// Main execution
if (require.main === module) {
    const program = new Command();

    program
        .name('its-calculate-token-id')
        .description('Calculate deterministic token IDs for InterchainTokenService')
        .requiredOption('--type <type>', 'Type of token ID to calculate (interchain, canonical, linked)')
        .option('--deployer <address>', 'Deployer address (required for interchain and linked types)')
        .option('--salt <salt>', 'Salt value (required for interchain and linked types)')
        .option('--tokenAddress <address>', 'Token address (required for canonical type)')
        .option('--itsAddress <address>', 'InterchainTokenService address (defaults to config)')
        .option('--factoryAddress <address>', 'InterchainTokenFactory address (defaults to config)')
        .addHelpText('after', `
Examples:
  Calculate interchain token ID:
    $ its-calculate-token-id --type interchain --deployer 0x123... --salt my-salt

  Calculate canonical token ID:
    $ its-calculate-token-id --type canonical --tokenAddress 0x456...

  Calculate linked token ID:
    $ its-calculate-token-id --type linked --deployer 0x789... --salt link-salt

Token ID Types:
  - interchain: For tokens deployed via deploy_interchain_token
  - canonical: For existing tokens registered as canonical
  - linked: For tokens linked via the factory`);

    addStarknetOptions(program, { offlineSupport: false }); // Don't require private key for this read-only operation

    program.action(async (options) => {
        // Validate type
        if (!['interchain', 'canonical', 'linked'].includes(options.type)) {
            throw new Error('Type must be one of: interchain, canonical, linked');
        }

        // Validate required parameters based on type
        if (options.type === 'interchain' || options.type === 'linked') {
            if (!options.deployer || !options.salt) {
                throw new Error(`Deployer and salt are required for ${options.type} token ID calculation`);
            }
        } else if (options.type === 'canonical') {
            if (!options.tokenAddress) {
                throw new Error('Token address is required for canonical token ID calculation');
            }
        }

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
    calculateTokenId: processCommand,
};
