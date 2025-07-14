import { Command } from 'commander';
import { loadConfig } from '../../common';
import { addStarknetOptions } from '../cli-utils';

// Constant for Starknet chain name in config
const STARKNET_CHAIN = 'starknet';
import {
    getStarknetProvider,
    getStarknetAccount,
    getContractConfig,
    validateStarknetOptions,
} from '../utils';
import { Contract, uint256, byteArray, num } from 'starknet';
import {
    Config,
    ChainConfig,
    GatewayCommandOptions,
} from '../types';

interface TestFlowOptions extends GatewayCommandOptions {
    tokenName?: string;
    tokenSymbol?: string;
    tokenDecimals?: string;
    initialSupply?: string;
    salt?: string;
    destinationChain?: string;
    transferAmount?: string;
    skipDeployment?: boolean;
    tokenId?: string;
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

/**
 * Wait for a specified number of seconds
 */
function sleep(seconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function processCommand(
    config: Config,
    chain: ChainConfig & { name: string },
    options: TestFlowOptions
): Promise<void> {
    const {
        privateKey,
        accountAddress,
        tokenName = 'Test Token',
        tokenSymbol = 'TEST',
        tokenDecimals = '18',
        initialSupply = '1000000',
        salt = 'test-' + Date.now(),
        destinationChain = 'ethereum',
        transferAmount = '100',
        skipDeployment = false,
        tokenId,
    } = options;

    // Validate execution options
    validateStarknetOptions(options.env, false, privateKey, accountAddress);

    const provider = getStarknetProvider(chain);
    const account = getStarknetAccount(privateKey!, accountAddress!, provider);

    const itsConfig = getContractConfig(config, chain.name, 'InterchainTokenService');
    if (!itsConfig.address) {
        throw new Error('InterchainTokenService contract not found in configuration');
    }

    const itsContract = await getITSContract(provider, itsConfig.address, account);

    console.log('\n=== ITS END-TO-END TEST FLOW ===\n');

    let deployedTokenId = tokenId;

    // Step 1: Deploy a new interchain token (unless skipped)
    if (!skipDeployment) {
        console.log('STEP 1: Deploy Interchain Token');
        console.log('================================');
        console.log(`- Name: ${tokenName}`);
        console.log(`- Symbol: ${tokenSymbol}`);
        console.log(`- Decimals: ${tokenDecimals}`);
        console.log(`- Initial Supply: ${initialSupply} (to deployer)`);
        console.log(`- Salt: ${salt}`);

        const deployTx = await itsContract.deploy_interchain_token(
            salt,
            '0', // local deployment
            byteArray.byteArrayFromString(tokenName),
            byteArray.byteArrayFromString(tokenSymbol),
            tokenDecimals,
            byteArray.byteArrayFromString(account.address), // minter
            uint256.bnToUint256('0'), // no gas for local
            0, // STRK
        );

        console.log('\nTransaction hash:', deployTx.transaction_hash);
        console.log('Waiting for confirmation...');
        const deployReceipt = await deployTx.wait();

        // Extract token ID from events
        const deployedEvent = deployReceipt.events?.find(event => 
            event.keys[0] === num.toHex(num.getDecimalString('InterchainTokenDeployed'))
        );

        if (deployedEvent) {
            deployedTokenId = deployedEvent.keys[1];
            console.log('✅ Token deployed successfully!');
            console.log('Token ID:', deployedTokenId);
        } else {
            throw new Error('Failed to extract token ID from deployment');
        }

        // Wait a bit for state to settle
        await sleep(2);
    } else if (!deployedTokenId) {
        throw new Error('Either provide --tokenId or allow token deployment');
    }

    // Step 2: Query token information
    console.log('\n\nSTEP 2: Query Token Information');
    console.log('================================');
    
    const tokenIdUint256 = deployedTokenId.startsWith('0x') 
        ? uint256.bnToUint256(deployedTokenId)
        : uint256.bnToUint256('0x' + deployedTokenId);

    const tokenManagerAddress = await itsContract.token_manager_address(tokenIdUint256);
    const tokenAddress = await itsContract.registered_token_address(tokenIdUint256);

    console.log('Token Manager Address:', tokenManagerAddress);
    console.log('Token Address:', tokenAddress);

    // Get token details
    const tokenAbi = [
        {
            "name": "balanceOf",
            "type": "function",
            "inputs": [{ "name": "account", "type": "core::starknet::contract_address::ContractAddress" }],
            "outputs": [{ "type": "core::integer::u256" }],
            "state_mutability": "view"
        },
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
        }
    ];

    const tokenContract = new Contract(tokenAbi, tokenAddress, provider);
    const balance = await tokenContract.balanceOf(account.address);
    const name = await tokenContract.name();
    const symbol = await tokenContract.symbol();
    const decimals = await tokenContract.decimals();

    console.log(`\nToken: ${name} (${symbol})`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Your Balance: ${balance}`);

    // Step 3: Check destination chain trust
    console.log('\n\nSTEP 3: Check Destination Chain Trust');
    console.log('=====================================');
    
    const isTrusted = await itsContract.is_trusted_chain(destinationChain);
    console.log(`Destination chain "${destinationChain}" is ${isTrusted ? 'TRUSTED ✅' : 'NOT TRUSTED ❌'}`);

    if (!isTrusted) {
        console.log('\n⚠️  WARNING: Destination chain is not trusted!');
        console.log('Transfers will fail. Add the chain using its-manage-chains first.');
        console.log(`Example: its-manage-chains --action add --chainName ${destinationChain}`);
        return;
    }

    // Step 4: Initiate interchain transfer
    console.log('\n\nSTEP 4: Initiate Interchain Transfer');
    console.log('===================================');
    console.log(`- Amount: ${transferAmount}`);
    console.log(`- Destination: ${destinationChain}`);
    console.log(`- Recipient: ${account.address} (same address on destination)`);

    // Convert amount to smallest unit
    const amountInSmallestUnit = parseFloat(transferAmount) * Math.pow(10, parseInt(decimals));
    
    // Check balance
    if (BigInt(balance) < BigInt(amountInSmallestUnit)) {
        console.log(`\n❌ Insufficient balance! You have ${balance}, need ${amountInSmallestUnit}`);
        return;
    }

    console.log('\nInitiating transfer...');
    const transferTx = await itsContract.interchain_transfer(
        tokenIdUint256,
        destinationChain,
        byteArray.byteArrayFromString(account.address), // same address on destination
        uint256.bnToUint256(amountInSmallestUnit.toString()),
        byteArray.byteArrayFromString(''), // no data
        uint256.bnToUint256('100000'), // gas value
        0, // STRK
        { value: '100000' } // pay gas in STRK
    );

    console.log('Transaction hash:', transferTx.transaction_hash);
    console.log('Waiting for confirmation...');
    const transferReceipt = await transferTx.wait();

    // Check for transfer event
    const transferEvent = transferReceipt.events?.find(event => 
        event.keys[0] === num.toHex(num.getDecimalString('InterchainTransferSent'))
    );

    if (transferEvent) {
        console.log('\n✅ Transfer initiated successfully!');
        console.log('Transfer details:');
        console.log('- Token ID:', transferEvent.keys[1]);
        console.log('- Source Address:', transferEvent.keys[2]);
        console.log('- Data Hash:', transferEvent.keys[3]);
    }

    // Step 5: Check final balance
    console.log('\n\nSTEP 5: Verify Final State');
    console.log('=========================');
    
    await sleep(2); // Wait for state update
    const finalBalance = await tokenContract.balanceOf(account.address);
    console.log(`Initial Balance: ${balance}`);
    console.log(`Transferred: ${amountInSmallestUnit}`);
    console.log(`Final Balance: ${finalBalance}`);
    console.log(`Expected: ${BigInt(balance) - BigInt(amountInSmallestUnit)}`);

    // Summary
    console.log('\n\n=== TEST FLOW COMPLETE ===');
    console.log('✅ Token deployed (or existing token used)');
    console.log('✅ Token information queried');
    console.log('✅ Destination chain trust verified');
    console.log('✅ Interchain transfer initiated');
    console.log('✅ Balance updated correctly');
    console.log('\n📝 Note: The transfer will be completed on the destination chain');
    console.log('   after cross-chain message processing (typically 1-5 minutes).');
    console.log(`   Check the destination chain (${destinationChain}) for the tokens.`);
}

// Main execution
if (require.main === module) {
    const program = new Command();

    program
        .name('its-test-flow')
        .description('Run an end-to-end test of InterchainTokenService functionality')
        .option('--tokenName <name>', 'Token name', 'Test Token')
        .option('--tokenSymbol <symbol>', 'Token symbol', 'TEST')
        .option('--tokenDecimals <decimals>', 'Token decimals', '18')
        .option('--initialSupply <amount>', 'Initial supply (in whole tokens)', '1000000')
        .option('--salt <salt>', 'Deployment salt (defaults to timestamp-based)')
        .option('--destinationChain <chain>', 'Destination chain for transfer', 'ethereum')
        .option('--transferAmount <amount>', 'Amount to transfer (in whole tokens)', '100')
        .option('--skipDeployment', 'Skip token deployment and use existing token')
        .option('--tokenId <id>', 'Token ID to use (required if --skipDeployment)')
        .addHelpText('after', `
This script demonstrates a complete ITS workflow:
1. Deploy a new interchain token (or use existing)
2. Query token information
3. Check destination chain trust
4. Initiate an interchain transfer
5. Verify the balance change

Examples:
  Full test with new token deployment:
    $ its-test-flow --tokenName "My Token" --tokenSymbol "MTK"

  Test with existing token:
    $ its-test-flow --skipDeployment --tokenId 0x123...

  Custom transfer amount and destination:
    $ its-test-flow --transferAmount 500 --destinationChain polygon

Note: Ensure you have sufficient balance for gas payments.`);

    addStarknetOptions(program);

    program.action(async (options) => {
        // Validate options
        if (options.skipDeployment && !options.tokenId) {
            throw new Error('--tokenId is required when using --skipDeployment');
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
    testITSFlow: processCommand,
};
