import { Command } from 'commander';
import { loadConfig } from '../../common';
import { addStarknetOptions } from '../cli-utils';

// Constant for Starknet chain name in config
const STARKNET_CHAIN = 'starknet';
import {
    getStarknetProvider,
    getStarknetAccount,
    getContractConfig,
    handleOfflineTransaction,
    validateStarknetOptions,
    estimateGasAndDisplayArgs,
} from '../utils';
import { CallData, Call, Contract, uint256, byteArray, num, CairoCustomEnum } from 'starknet';
import {
    Config,
    ChainConfig,
    GatewayCommandOptions,
    OfflineTransactionResult
} from '../types';

interface TransferOptions extends GatewayCommandOptions {
    tokenId: string;
    destinationChain: string;
    destinationAddress: string;
    amount: string;
    data?: string;
    gasValue: string;
    gasToken: 'STRK' | 'ETH';
}

/**
 * Validate and parse hex string to ensure it's valid
 * @param hexString - Hex string with or without 0x prefix
 * @returns Cleaned hex string without prefix
 */
function validateAndParseHexString(hexString: string): string {
    // Remove 0x prefix if present
    const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
    
    // Validate hex format
    if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
        throw new Error('Data must be a valid hex string containing only 0-9, a-f, A-F characters');
    }
    
    // Ensure even length (each byte = 2 hex chars)
    if (cleanHex.length % 2 !== 0) {
        throw new Error('Hex string must have even length (each byte requires 2 hex characters)');
    }
    
    return cleanHex;
}

/**
 * Convert hex string (raw bytes) directly to Cairo ByteArray format
 * This creates a ByteArray where the hex bytes are interpreted as raw data
 */
function hexStringToByteArray(hexString: string): any {
    // Validate and clean the hex string
    const cleanHex = validateAndParseHexString(hexString);
    
    // If empty, return empty ByteArray
    if (cleanHex.length === 0) {
        return [];
    }
    
    // Convert hex string to bytes, then to string for byteArrayFromString
    // This preserves the raw byte interpretation
    const bytes = Buffer.from(cleanHex, 'hex');
    
    // Convert to ByteArray using starknet.js
    return byteArray.byteArrayFromString(bytes.toString('latin1'));
}

/**
 * Helper function to get ITS contract instance with ABI
 */
async function getITSContract(
    provider: any,
    address: string,
    account?: any
): Promise<Contract> {
    const { abi } = await provider.getClassAt(address);
    const contract = new Contract(abi, address, provider);
    if (account) {
        contract.connect(account);
    }
    return contract;
}

async function processCommand(
    config: Config,
    chain: ChainConfig & { name: string },
    options: TransferOptions
): Promise<any | OfflineTransactionResult> {
    const {
        privateKey,
        accountAddress,
        tokenId,
        destinationChain,
        destinationAddress,
        amount,
        data,
        gasValue,
        gasToken,
        offline,
        estimate,
    } = options;

    // Validate execution options
    validateStarknetOptions(options.env, offline, privateKey, accountAddress);
    
    // Validate data format if provided
    if (data) {
        try {
            validateAndParseHexString(data);
        } catch (error) {
            throw new Error(`Invalid data format: ${error.message}`);
        }
    }

    const provider = getStarknetProvider(chain);

    const itsConfig = getContractConfig(config, chain.name, 'InterchainTokenService');
    if (!itsConfig.address) {
        throw new Error('InterchainTokenService contract not found in configuration');
    }

    console.log(`\nInterchain Token Transfer:`);
    console.log(`- Token ID: ${tokenId}`);
    console.log(`- Destination Chain: ${destinationChain}`);
    console.log(`- Destination Address: ${destinationAddress}`);
    console.log(`- Amount: ${amount}`);
    console.log(`- Data: ${data || 'none'} ${data ? '(hex bytes)' : ''}`);
    console.log(`- Gas Value: ${gasValue}`);
    console.log(`- Gas Token: ${gasToken} (only STRK is supported currently)`);

    // Convert token ID to uint256 if it's a hex string
    let tokenIdUint256;
    if (tokenId.startsWith('0x')) {
        tokenIdUint256 = uint256.bnToUint256(tokenId);
    } else {
        tokenIdUint256 = uint256.bnToUint256('0x' + tokenId);
    }

    // Build calldata for interchain_transfer
    const dataByteArray = data ? hexStringToByteArray(data) : [];
    const calldata = CallData.compile([
        tokenIdUint256, // token_id: u256
        destinationChain, // destination_chain: felt252
        byteArray.byteArrayFromString(destinationAddress), // destination_address: ByteArray
        uint256.bnToUint256(amount), // amount: u256
        dataByteArray, // data: ByteArray (empty if not provided)
        uint256.bnToUint256(gasValue), // gas_value: u256
        gasToken === 'ETH' ? new CairoCustomEnum({ Eth: {} }) : new CairoCustomEnum({ Strk: {} }), // gas_token: GasToken enum
    ]);

    const hexCalldata = calldata.map(item => num.toHex(item));

    // Handle estimate mode
    if (estimate) {
        console.log(`\nEstimating gas for interchain transfer on ${chain.name}...`);

        const account = getStarknetAccount(privateKey!, accountAddress!, provider);
        const calls: Call[] = [{
            contractAddress: itsConfig.address,
            entrypoint: 'interchain_transfer',
            calldata
        }];

        await estimateGasAndDisplayArgs(account, calls);
        return {}; // Return empty for estimation
    }

    // Handle offline mode
    if (offline) {
        console.log(`\nGenerating unsigned transaction for interchain transfer on ${chain.name}...`);
        const calls = [{
            contractAddress: itsConfig.address,
            entrypoint: 'interchain_transfer',
            calldata: hexCalldata
        }];

        return handleOfflineTransaction(
            options,
            chain.name,
            calls,
            'interchain_transfer'
        );
    }

    // Execute the transaction
    const account = getStarknetAccount(privateKey!, accountAddress!, provider);
    const itsContract = await getITSContract(provider, itsConfig.address, account);

    // First, check if the token exists and get token address
    console.log('\nChecking token status...');
    try {
        const tokenManagerAddress = await itsContract.token_manager_address(tokenIdUint256);
        const tokenAddress = await itsContract.registered_token_address(tokenIdUint256);
        console.log('Token Manager Address:', tokenManagerAddress);
        console.log('Token Address:', tokenAddress);

        // Check if user has sufficient balance (optional, for better UX)
        const tokenAbi = [
            {
                "name": "balanceOf",
                "type": "function",
                "inputs": [{ "name": "account", "type": "core::starknet::contract_address::ContractAddress" }],
                "outputs": [{ "type": "core::integer::u256" }],
                "state_mutability": "view"
            }
        ];
        const tokenContract = new Contract(tokenAbi, tokenAddress, provider);
        const balance = await tokenContract.balanceOf(account.address);
        console.log(`Current balance: ${balance}`);

        const amountBN = BigInt(amount);
        if (BigInt(balance) < amountBN) {
            throw new Error(`Insufficient balance. Current balance: ${balance}, required: ${amount}`);
        }
    } catch (error) {
        console.warn('Could not verify token balance:', error.message);
    }

    console.log('\nExecuting interchain_transfer...');

    const tx = await itsContract.interchain_transfer(
        tokenIdUint256,
        destinationChain,
        destinationAddress,
        uint256.bnToUint256(amount),
        data ? hexStringToByteArray(data) : [],
        uint256.bnToUint256(gasValue),
        gasToken === 'ETH' ? new CairoCustomEnum({ Eth: {} }) : new CairoCustomEnum({ Strk: {} })
    );

    console.log('Transaction hash:', tx.transaction_hash);
    console.log('\nWaiting for transaction to be accepted...');

    const receipt = await tx.wait();
    console.log('Transaction accepted in block:', receipt.block_number);

    // Parse InterchainTransferSent event
    const transferEvent = receipt.events?.find(event =>
        event.keys[0] === num.toHex(num.getDecimalString('InterchainTransferSent'))
    );

    if (transferEvent) {
        console.log('\nInterchain transfer initiated successfully!');
        console.log('Transfer details from event:');
        console.log('- Token ID:', transferEvent.keys[1]);
        console.log('- Source Address:', transferEvent.keys[2]);
        console.log('- Data Hash:', transferEvent.keys[3]);
    } else {
        console.log('\nTransaction completed. Check explorer for transfer details.');
    }

    return tx.transaction_hash;
}

// Main execution
if (require.main === module) {
    const program = new Command();

    program
        .name('its-transfer')
        .description('Transfer tokens across chains using InterchainTokenService')
        .requiredOption('--tokenId <id>', 'Token ID (hex string)')
        .requiredOption('--destinationChain <chain>', 'Destination chain name')
        .requiredOption('--destinationAddress <address>', 'Destination address')
        .requiredOption('--amount <amount>', 'Amount to transfer (in smallest unit)')
        .option('--data <data>', 'Optional data as hex string (e.g., 0x1234abcd or 1234abcd)')
        .requiredOption('--gasValue <value>', 'Gas value for cross-chain execution')
        .option('--gasToken <token>', 'Gas token (only STRK is supported currently)', 'STRK')
        .addHelpText('after', `
Examples:
  Transfer with data:
    $ transfer --tokenId 0x123... --destinationChain ethereum --destinationAddress 0x456... --amount 1000 --data 0xdeadbeef --gasValue 100000
  
  Transfer without data:
    $ transfer --tokenId 0x123... --destinationChain ethereum --destinationAddress 0x456... --amount 1000 --gasValue 100000

Note: The --data parameter expects raw bytes as a hex string (with or without 0x prefix).
Each byte must be represented by exactly 2 hex characters.`);

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
    interchainTransfer: processCommand,
};
