'use strict';

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { UnsignedTransaction } from './types';

interface SignedTransaction extends UnsignedTransaction {
    signature: string[];
}

/**
 * Load and validate a transaction file
 */
function loadTransaction(filepath: string): SignedTransaction {
    if (!fs.existsSync(filepath)) {
        throw new Error(`File not found: ${filepath}`);
    }

    const data = fs.readFileSync(filepath, 'utf8');
    const transaction = JSON.parse(data);

    // Validate that no 'signatures' field exists
    if ('signatures' in transaction) {
        throw new Error(`Transaction file ${filepath} contains 'signatures' field. Only 'signature' field is allowed.`);
    }

    // Validate that signature exists and is valid
    if (!transaction.signature || !Array.isArray(transaction.signature) || transaction.signature.length !== 2) {
        throw new Error(`Transaction file ${filepath} does not contain a valid signature. Expected array with 2 elements [r, s].`);
    }

    return transaction;
}

/**
 * Compare two transactions to ensure all fields match except signature
 */
function compareTransactions(tx1: SignedTransaction, tx2: SignedTransaction, file1: string, file2: string): void {
    const fieldsToCompare = [
        'type', 'version', 'sender_address', 'nonce',
        'resource_bounds', 'tip', 'paymaster_data',
        'account_deployment_data', 'nonce_data_availability_mode',
        'fee_data_availability_mode'
    ];

    for (const field of fieldsToCompare) {
        if (JSON.stringify(tx1[field]) !== JSON.stringify(tx2[field])) {
            throw new Error(`Transaction field '${field}' mismatch between ${file1} and ${file2}`);
        }
    }

    // Deep compare calls
    if (JSON.stringify(tx1.calls) !== JSON.stringify(tx2.calls)) {
        throw new Error(`Transaction calls mismatch between ${file1} and ${file2}`);
    }
}

/**
 * Generate output filename with timestamp
 */
function generateOutputFilename(): string {
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
    return path.join('starknet-offline-txs', `tx_multisig_signed_${timestamp}.json`);
}

/**
 * Combine multiple signatures into a single multisig transaction
 */
function combineSignatures(
    signatureFiles: string[],
    outputFile?: string
): void {
    console.log('🔄 Combining signatures for Starknet Argent multisig transaction...\n');

    // Load all transactions
    console.log(`📄 Loading ${signatureFiles.length} signed transactions...`);
    const transactions = signatureFiles.map((file, index) => {
        console.log(`  ${index + 1}. ${file}`);
        return { file, tx: loadTransaction(file) };
    });

    // Use first transaction as base
    const baseTx = transactions[0].tx;
    const baseFile = transactions[0].file;

    // Validate all transactions match
    console.log('\n🔍 Validating transaction consistency...');
    for (let i = 1; i < transactions.length; i++) {
        compareTransactions(baseTx, transactions[i].tx, baseFile, transactions[i].file);
    }
    console.log('  ✅ All transactions match (except signatures)');

    // Extract all signatures
    console.log('\n📝 Extracting signatures...');
    const signatures: string[] = [];

    transactions.forEach(({ file, tx }, index) => {
        console.log(`  ${index + 1}. ${file}`);
        console.log(`     r: ${tx.signature[0].slice(0, 10)}...`);
        console.log(`     s: ${tx.signature[1].slice(0, 10)}...`);
        signatures.push(...tx.signature);
    });

    // Create Argent multisig format: [signature_count, sig1_r, sig1_s, sig2_r, sig2_s, ...]
    const signatureCount = transactions.length;
    const multisigSignature = [
        `0x${signatureCount.toString(16)}`,
        ...signatures
    ];

    console.log(`\n📊 Combined signature format:`);
    console.log(`  Signature count: ${signatureCount}`);
    console.log(`  Total elements: ${multisigSignature.length} (1 count + ${signatures.length} signature components)`);

    // Create output transaction
    const outputTransaction = {
        ...baseTx,
        signature: multisigSignature
    };

    // Determine output path
    const outputPath = outputFile || generateOutputFilename();

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save combined transaction
    fs.writeFileSync(outputPath, JSON.stringify(outputTransaction, null, 2));

    console.log(`\n✅ Multisig transaction saved to: ${outputPath}`);
    console.log('\n💡 Next steps:');
    console.log('  Use broadcast-transaction.ts to submit this multisig transaction to the network');
}

async function main(): Promise<void> {
    const program = new Command();

    program
        .name('combine-signatures')
        .description('Combine multiple signatures into Starknet Argent multisig format')
        .version('1.0.0')
        .argument('<signatureFiles...>', 'signed transaction files to combine (at least 2 required)')
        .option('-o, --output <file>', 'output file path (default: starknet-offline-txs/tx_multisig_signed_<timestamp>.json)')
        .parse();

    const signatureFiles = program.args;
    const options = program.opts();

    try {
        combineSignatures(signatureFiles, options.output);
    } catch (error: any) {
        console.error('\n❌ Failed to combine signatures:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

export { combineSignatures };

