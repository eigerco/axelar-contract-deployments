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
    console.log(`- Data: ${data || 'none'}`);
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
    const calldata = CallData.compile([
        tokenIdUint256, // token_id: u256
        destinationChain, // destination_chain: felt252
        byteArray.byteArrayFromString(destinationAddress), // destination_address: ByteArray
        uint256.bnToUint256(amount), // amount: u256
        data ? byteArray.byteArrayFromString(data) : [], // data: ByteArray (empty if not provided)
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
        data || '',
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
        .option('--data <data>', 'Optional data for contract execution')
        .requiredOption('--gasValue <value>', 'Gas value for cross-chain execution')
        .option('--gasToken <token>', 'Gas token (only STRK is supported currently)', 'STRK');

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
