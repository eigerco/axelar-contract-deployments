

import { Command } from 'commander';
import * as fs from 'fs';
import { RpcProvider } from 'starknet';
import { loadConfig } from '../common';
import { getStarknetProvider } from './utils';

const STARKNET_CHAIN = 'starknet';

interface SignedInvokeTransaction {
    type: 'INVOKE';
    sender_address: string;
    calldata: string[];
    version: string;
    signature: string[];
    nonce: string;
    resource_bounds: any;
    tip: string;
    paymaster_data: string[];
    account_deployment_data: string[];
    nonce_data_availability_mode: string;
    fee_data_availability_mode: string;
    // Optional fields for Ledger signing (not part of INVOKE_TXN_V3 spec)
    entrypoint_name?: string;
    contract_address?: string;
    timestamp?: number;
}

/**
 * Load and validate a signed invoke transaction file
 */
function loadSignedTransaction(filepath: string): SignedInvokeTransaction {
    if (!fs.existsSync(filepath)) {
        throw new Error(`Transaction file not found: ${filepath}`);
    }

    const data = fs.readFileSync(filepath, 'utf8');
    const transaction = JSON.parse(data);

    if (!transaction.type || transaction.type !== 'INVOKE') {
        throw new Error('Transaction must be an INVOKE transaction');
    }

    if (!transaction.version || transaction.version !== '0x3') {
        throw new Error('Transaction must be version 0x3');
    }

    if (!transaction.signature || !Array.isArray(transaction.signature) || transaction.signature.length === 0) {
        throw new Error('Transaction must have a valid signature array');
    }

    if (!transaction.sender_address) {
        throw new Error('Transaction must have a sender_address');
    }

    if (!transaction.calldata || !Array.isArray(transaction.calldata)) {
        throw new Error('INVOKE transaction must have calldata array');
    }

    if (!transaction.nonce_data_availability_mode) {
        throw new Error('Transaction must have nonce_data_availability_mode');
    }

    if (!transaction.fee_data_availability_mode) {
        throw new Error('Transaction must have fee_data_availability_mode');
    }

    return transaction;
}

/**
 * Broadcast a signed invoke transaction to Starknet using provider.fetch
 */
async function broadcastTransaction(
    provider: RpcProvider,
    transaction: SignedInvokeTransaction
): Promise<void> {
    try {
        console.log('🚀 Broadcasting INVOKE transaction...');
        console.log(`  Sender: ${transaction.sender_address}`);
        console.log(`  Nonce: ${transaction.nonce}`);
        console.log(`  Calldata length: ${transaction.calldata.length}`);
        console.log(`  Signature length: ${transaction.signature.length}`);

        // Remove extra fields not part of INVOKE_TXN_V3 spec before broadcasting
        const cleanTransaction = {
            type: transaction.type,
            sender_address: transaction.sender_address,
            calldata: transaction.calldata,
            version: transaction.version,
            signature: transaction.signature,
            nonce: transaction.nonce,
            resource_bounds: transaction.resource_bounds,
            tip: transaction.tip,
            paymaster_data: transaction.paymaster_data,
            account_deployment_data: transaction.account_deployment_data,
            nonce_data_availability_mode: transaction.nonce_data_availability_mode,
            fee_data_availability_mode: transaction.fee_data_availability_mode
        };

        // Use provider.fetch to directly submit the signed transaction
        const response = await provider.fetch('starknet_addInvokeTransaction', {
            invoke_transaction: cleanTransaction
        });

        const result = await response.json();
        if (result && result.error) {
            throw result.error;
        }

        console.log('✅ Transaction broadcasted successfully!');
        console.log(`  Transaction hash: ${result.result.transaction_hash}`);

        console.log('⏳ Waiting for transaction confirmation...');
        const receipt = await provider.waitForTransaction(result.result.transaction_hash);

        if ('execution_status' in receipt && receipt.execution_status === 'SUCCEEDED') {
            console.log('✅ Transaction confirmed successfully!');
            if ('block_number' in receipt) {
                console.log(`  Block number: ${receipt.block_number}`);
            }
            if ('block_hash' in receipt) {
                console.log(`  Block hash: ${receipt.block_hash}`);
            }
        } else {
            console.log('❌ Transaction failed');
            if ('execution_status' in receipt) {
                console.log(`  Execution status: ${receipt.execution_status}`);
            }
            if ('revert_reason' in receipt && receipt.revert_reason) {
                console.log(`  Revert reason: ${receipt.revert_reason}`);
            }
        }

    } catch (error) {
        console.error('❌ Failed to broadcast transaction:');
        console.error(error);
        throw error;
    }
}

/**
 * Main command processing function
 */
async function processCommand(options: {
    environment: string;
    transactionFile: string;
}): Promise<void> {
    try {
        const config = loadConfig(options.environment);
        const starknetConfig = config.chains[STARKNET_CHAIN];

        if (!starknetConfig) {
            throw new Error(`Starknet configuration not found for environment: ${options.environment}`);
        }

        console.log(`🌐 Broadcasting to: ${starknetConfig.name} (${options.environment})`);
        console.log(`  RPC: ${starknetConfig.rpc}`);

        const provider = getStarknetProvider(starknetConfig);
        const transaction = loadSignedTransaction(options.transactionFile);

        await broadcastTransaction(provider, transaction);

    } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

if (require.main === module) {
    const program = new Command();

    program
        .name('broadcast-transaction')
        .description('Broadcast a signed Starknet v3 INVOKE transaction from a JSON file')
        .argument('<transaction-file>', 'Path to the signed transaction JSON file')
        .requiredOption('-e, --env <environment>', 'Environment (e.g., testnet, mainnet)')
        .action((transactionFile, options) => processCommand({ environment: options.env, transactionFile }));

    program.parse();
}

export { processCommand, broadcastTransaction, loadSignedTransaction };
