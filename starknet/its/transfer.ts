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
 * Detect if input is hex string or regular string
 * @returns {isHex: boolean, cleanHex?: string}
 */
function detectDataFormat(data: string): { isHex: boolean; cleanHex?: string } {
    // Only treat as hex if it starts with 0x
    if (data.startsWith('0x')) {
        const cleanHex = data.slice(2);
        // Validate hex format
        if (/^[0-9a-fA-F]*$/.test(cleanHex) && cleanHex.length % 2 === 0) {
            return { isHex: true, cleanHex };
        }
        throw new Error('Invalid hex format after 0x prefix - must contain only 0-9, a-f, A-F and have even length');
    }
    
    // Everything else is treated as a string
    return { isHex: false };
}

/**
 * Convert data (hex or string) to ByteArray format
 * For use with CallData.compile
 */
function dataToByteArrayStruct(data: string): any {
    const { isHex, cleanHex } = detectDataFormat(data);
    
    if (isHex && cleanHex) {
        // Handle as hex bytes
        if (cleanHex.length === 0) {
            return {
                data: [],
                pending_word: '0x0',
                pending_word_len: 0
            };
        }
        
        // Convert hex to bytes
        const bytes = Buffer.from(cleanHex, 'hex');

        // Build ByteArray structure manually
        const dataArray: string[] = [];
        let offset = 0;

        // Process 31-byte chunks
        while (offset + 31 <= bytes.length) {
            const chunk = bytes.slice(offset, offset + 31);
            // Convert chunk to hex string with 0x prefix
            dataArray.push('0x' + chunk.toString('hex'));
            offset += 31;
        }

        // Handle remaining bytes (pending_word)
        let pending_word = '0x0';
        let pending_word_len = 0;

        if (offset < bytes.length) {
            const remaining = bytes.slice(offset);
            pending_word = '0x' + remaining.toString('hex');
            pending_word_len = remaining.length;
        }

        return {
            data: dataArray,
            pending_word,
            pending_word_len
        };
    } else {
        // Handle as UTF-8 string - use starknet.js's byteArrayFromString
        return byteArray.byteArrayFromString(data);
    }
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
            detectDataFormat(data); // This will throw if invalid hex after 0x
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
    if (data) {
        const { isHex } = detectDataFormat(data);
        console.log(`- Data: ${data} (${isHex ? 'hex bytes' : 'string'})`);
    } else {
        console.log(`- Data: none`);
    }
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
    const dataByteArray = data ? dataToByteArrayStruct(data) : { data: [], pending_word: '0x0', pending_word_len: 0 };
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

    // Use the pre-compiled calldata for the transaction
    const tx = await account.execute({
        contractAddress: itsConfig.address,
        entrypoint: 'interchain_transfer',
        calldata: hexCalldata
    });

    console.log('Transaction hash:', tx.transaction_hash);
    console.log('\nWaiting for transaction to be accepted...');

    const receipt = await provider.waitForTransaction(tx.transaction_hash);
    console.log('Transaction accepted');

    // Check if receipt has the expected properties
    if ('block_number' in receipt) {
        console.log('Block number:', receipt.block_number);
    }

    // Parse InterchainTransferSent event
    if ('events' in receipt && Array.isArray(receipt.events)) {
        const transferEvent = receipt.events.find(event =>
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
        .option('--data <data>', 'Optional data (hex bytes with 0x prefix, or UTF-8 string)')
        .requiredOption('--gasValue <value>', 'Gas value for cross-chain execution')
        .option('--gasToken <token>', 'Gas token (only STRK is supported currently)', 'STRK')
        .addHelpText('after', `
Examples:
  Transfer with hex data:
    $ transfer --tokenId 0x123... --destinationChain ethereum --destinationAddress 0x456... --amount 1000 --data 0xdeadbeef --gasValue 100000
  
  Transfer with string data:
    $ transfer --tokenId 0x123... --destinationChain ethereum --destinationAddress 0x456... --amount 1000 --data "Hello World" --gasValue 100000
    $ transfer --tokenId 0x123... --destinationChain ethereum --destinationAddress 0x456... --amount 1000 --data cafe --gasValue 100000
  
  Transfer without data:
    $ transfer --tokenId 0x123... --destinationChain ethereum --destinationAddress 0x456... --amount 1000 --gasValue 100000

Note: The --data parameter accepts:
  - Hex bytes: Must start with 0x prefix (e.g., 0xdeadbeef)
  - Strings: Everything else is treated as UTF-8 string (e.g., "Hello", cafe, deadbeef)`);

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
