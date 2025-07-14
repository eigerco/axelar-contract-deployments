import { Command } from 'commander';
import { loadConfig } from '../../common';
import { addStarknetOptions } from '../cli-utils';

// Constant for Starknet chain name in config
const STARKNET_CHAIN = 'starknet';
import {
    getStarknetProvider,
    getContractConfig,
} from '../utils';
import { Contract, uint256 } from 'starknet';
import {
    Config,
    ChainConfig,
} from '../types';

interface QueryOptions {
    query: 'token-manager' | 'token-address' | 'interchain-token-address' | 'chain-name' | 'trusted-chain' | 'flow-limit' | 'token-info';
    tokenId?: string;
    chainName?: string;
    env?: string;
    itsAddress?: string;
}

/**
 * Helper function to get ITS contract instance with ABI
 */
async function getITSContract(
    provider: any,
    address: string
): Promise<Contract> {
    const { abi } = await provider.getClassAt(address);
    const contract = new Contract(abi, address, provider);
    return contract;
}

/**
 * Parse token ID from string to uint256 format
 */
function parseTokenId(tokenIdStr: string): any {
    if (tokenIdStr.startsWith('0x')) {
        return uint256.bnToUint256(tokenIdStr);
    } else {
        return uint256.bnToUint256('0x' + tokenIdStr);
    }
}

async function processCommand(
    config: Config,
    chain: ChainConfig & { name: string },
    options: QueryOptions
): Promise<void> {
    const {
        query,
        tokenId,
        chainName,
        itsAddress,
    } = options;

    const provider = getStarknetProvider(chain);

    // Get ITS address
    const itsContractAddress = itsAddress || getContractConfig(config, chain.name, 'InterchainTokenService').address;
    if (!itsContractAddress) {
        throw new Error('InterchainTokenService contract not found. Provide --itsAddress or deploy ITS first.');
    }

    const itsContract = await getITSContract(provider, itsContractAddress);

    console.log(`\nQuerying InterchainTokenService:`);
    console.log(`- Query Type: ${query}`);
    console.log(`- ITS Address: ${itsContractAddress}`);

    switch (query) {
        case 'token-manager': {
            if (!tokenId) {
                throw new Error('Token ID is required for token-manager query');
            }

            console.log(`- Token ID: ${tokenId}`);

            const tokenIdUint256 = parseTokenId(tokenId);
            const tokenManagerAddress = await itsContract.token_manager_address(tokenIdUint256);

            console.log('\n=== RESULT ===');
            console.log(`Token Manager Address: ${tokenManagerAddress}`);

            // Try to check if it's deployed
            try {
                const tokenAddress = await itsContract.registered_token_address(tokenIdUint256);
                console.log(`Associated Token Address: ${tokenAddress}`);
                console.log('Status: Token Manager is deployed and active');
            } catch (error) {
                console.log('Status: Token Manager address calculated but may not be deployed yet');
            }

            break;
        }

        case 'token-address': {
            if (!tokenId) {
                throw new Error('Token ID is required for token-address query');
            }

            console.log(`- Token ID: ${tokenId}`);

            const tokenIdUint256 = parseTokenId(tokenId);

            try {
                const tokenAddress = await itsContract.registered_token_address(tokenIdUint256);
                console.log('\n=== RESULT ===');
                console.log(`Registered Token Address: ${tokenAddress}`);
            } catch (error) {
                console.log('\n=== RESULT ===');
                console.log('No token registered for this token ID');
                console.log('Note: Token manager may not be deployed yet');
            }

            break;
        }

        case 'interchain-token-address': {
            if (!tokenId) {
                throw new Error('Token ID is required for interchain-token-address query');
            }

            console.log(`- Token ID: ${tokenId}`);

            const tokenIdUint256 = parseTokenId(tokenId);
            const interchainTokenAddress = await itsContract.interchain_token_address(tokenIdUint256);

            console.log('\n=== RESULT ===');
            console.log(`Interchain Token Address: ${interchainTokenAddress}`);
            console.log('Note: This is the predicted address where the token will be deployed');

            break;
        }

        case 'chain-name': {
            const chainNameResult = await itsContract.chain_name();

            console.log('\n=== RESULT ===');
            console.log(`Chain Name: ${chainNameResult}`);

            break;
        }

        case 'trusted-chain': {
            if (!chainName) {
                throw new Error('Chain name is required for trusted-chain query');
            }

            console.log(`- Chain to Check: ${chainName}`);

            const isTrusted = await itsContract.is_trusted_chain(chainName);

            console.log('\n=== RESULT ===');
            console.log(`Chain "${chainName}" is ${isTrusted ? 'TRUSTED' : 'NOT TRUSTED'}`);

            break;
        }

        case 'flow-limit': {
            if (!tokenId) {
                throw new Error('Token ID is required for flow-limit query');
            }

            console.log(`- Token ID: ${tokenId}`);

            const tokenIdUint256 = parseTokenId(tokenId);

            try {
                // First get the token manager address
                const tokenManagerAddress = await itsContract.token_manager_address(tokenIdUint256);
                
                // Then query the token manager for flow limit
                const tokenManagerAbi = [
                    {
                        "name": "flow_limit",
                        "type": "function",
                        "inputs": [],
                        "outputs": [{ "type": "core::integer::u256" }],
                        "state_mutability": "view"
                    },
                    {
                        "name": "flow_out_amount",
                        "type": "function",
                        "inputs": [],
                        "outputs": [{ "type": "core::integer::u256" }],
                        "state_mutability": "view"
                    },
                    {
                        "name": "flow_in_amount",
                        "type": "function",
                        "inputs": [],
                        "outputs": [{ "type": "core::integer::u256" }],
                        "state_mutability": "view"
                    }
                ];
                
                const tokenManager = new Contract(tokenManagerAbi, tokenManagerAddress, provider);
                const flowLimit = await tokenManager.flow_limit();
                const flowOut = await tokenManager.flow_out_amount();
                const flowIn = await tokenManager.flow_in_amount();

                console.log('\n=== RESULT ===');
                console.log(`Token Manager Address: ${tokenManagerAddress}`);
                console.log(`Flow Limit: ${flowLimit}`);
                console.log(`Current Flow Out: ${flowOut}`);
                console.log(`Current Flow In: ${flowIn}`);
                console.log(`Available Outflow: ${BigInt(flowLimit) - BigInt(flowOut)}`);

            } catch (error) {
                console.log('\n=== RESULT ===');
                console.log('Could not query flow limit. Token manager may not be deployed.');
                console.log(`Error: ${error.message}`);
            }

            break;
        }

        case 'token-info': {
            if (!tokenId) {
                throw new Error('Token ID is required for token-info query');
            }

            console.log(`- Token ID: ${tokenId}`);

            const tokenIdUint256 = parseTokenId(tokenId);

            console.log('\n=== TOKEN INFORMATION ===');

            // Get token manager address
            try {
                const tokenManagerAddress = await itsContract.token_manager_address(tokenIdUint256);
                console.log(`Token Manager: ${tokenManagerAddress}`);

                // Get token address
                try {
                    const tokenAddress = await itsContract.registered_token_address(tokenIdUint256);
                    console.log(`Token Address: ${tokenAddress}`);

                    // Try to get token details
                    const tokenAbi = [
                        {
                            "name": "name",
                            "type": "function",
                            "inputs": [],
                            "outputs": [{ "type": "core::byte_array::ByteArray" }],
                            "state_mutability": "view"
                        },
                        {
                            "name": "symbol",
                            "type": "function",
                            "inputs": [],
                            "outputs": [{ "type": "core::byte_array::ByteArray" }],
                            "state_mutability": "view"
                        },
                        {
                            "name": "decimals",
                            "type": "function",
                            "inputs": [],
                            "outputs": [{ "type": "core::integer::u8" }],
                            "state_mutability": "view"
                        },
                        {
                            "name": "totalSupply",
                            "type": "function",
                            "inputs": [],
                            "outputs": [{ "type": "core::integer::u256" }],
                            "state_mutability": "view"
                        }
                    ];

                    const tokenContract = new Contract(tokenAbi, tokenAddress, provider);
                    const name = await tokenContract.name();
                    const symbol = await tokenContract.symbol();
                    const decimals = await tokenContract.decimals();
                    const totalSupply = await tokenContract.totalSupply();

                    console.log(`\nToken Details:`);
                    console.log(`- Name: ${name}`);
                    console.log(`- Symbol: ${symbol}`);
                    console.log(`- Decimals: ${decimals}`);
                    console.log(`- Total Supply: ${totalSupply}`);

                    // Get token manager type
                    const tokenManagerAbi = [
                        {
                            "name": "implementation_type",
                            "type": "function",
                            "inputs": [],
                            "outputs": [{ "type": "crate::interfaces::token_manager::TokenManagerType" }],
                            "state_mutability": "view"
                        }
                    ];
                    const tokenManager = new Contract(tokenManagerAbi, tokenManagerAddress, provider);
                    const implementationType = await tokenManager.implementation_type();
                    
                    const typeNames = ['NativeInterchainToken', 'MintBurnFrom', 'LockUnlock', 'LockUnlockFee', 'MintBurn'];
                    console.log(`- Token Manager Type: ${typeNames[implementationType] || implementationType}`);

                } catch (error) {
                    console.log('Token: Not deployed or registered yet');
                }

            } catch (error) {
                console.log('Token Manager: Not found');
            }

            // Get interchain token address (predicted)
            const interchainTokenAddress = await itsContract.interchain_token_address(tokenIdUint256);
            console.log(`\nPredicted Interchain Token Address: ${interchainTokenAddress}`);

            break;
        }

        default:
            throw new Error(`Invalid query type: ${query}`);
    }
}

// Main execution
if (require.main === module) {
    const program = new Command();

    program
        .name('its-query')
        .description('Query InterchainTokenService for token and chain information')
        .requiredOption('--query <type>', 'Query type (token-manager, token-address, interchain-token-address, chain-name, trusted-chain, flow-limit, token-info)')
        .option('--tokenId <id>', 'Token ID (required for token queries)')
        .option('--chainName <name>', 'Chain name (required for trusted-chain query)')
        .option('--itsAddress <address>', 'InterchainTokenService address (defaults to config)')
        .addHelpText('after', `
Examples:
  Get token manager address:
    $ its-query --query token-manager --tokenId 0x123...

  Get registered token address:
    $ its-query --query token-address --tokenId 0x123...

  Get predicted interchain token address:
    $ its-query --query interchain-token-address --tokenId 0x123...

  Get chain name:
    $ its-query --query chain-name

  Check if chain is trusted:
    $ its-query --query trusted-chain --chainName ethereum

  Get flow limit information:
    $ its-query --query flow-limit --tokenId 0x123...

  Get complete token information:
    $ its-query --query token-info --tokenId 0x123...`);

    addStarknetOptions(program, { offlineSupport: false }); // Don't require private key for queries

    program.action(async (options) => {
        // Validate query type
        const validQueries = ['token-manager', 'token-address', 'interchain-token-address', 'chain-name', 'trusted-chain', 'flow-limit', 'token-info'];
        if (!validQueries.includes(options.query)) {
            throw new Error(`Query must be one of: ${validQueries.join(', ')}`);
        }

        // Validate required parameters
        const tokenQueries = ['token-manager', 'token-address', 'interchain-token-address', 'flow-limit', 'token-info'];
        if (tokenQueries.includes(options.query) && !options.tokenId) {
            throw new Error(`--tokenId is required for ${options.query} query`);
        }

        if (options.query === 'trusted-chain' && !options.chainName) {
            throw new Error('--chainName is required for trusted-chain query');
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
    queryITS: processCommand,
};
