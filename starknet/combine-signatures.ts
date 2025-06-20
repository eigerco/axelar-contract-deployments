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
    if (!transaction.signature || !Array.isArray(transaction.signature)) {
        throw new Error(`Transaction file ${filepath} does not contain a valid signature array.`);
    }
    
    // Check signature format - either [r, s] for non-multisig or [pubkey, r, s] for multisig
    if (transaction.signature.length === 2) {
        // Non-multisig format - not supported in combine-signatures
        throw new Error(`Transaction file ${filepath} contains a non-multisig signature [r, s]. Please sign with --multisig flag.`);
    } else if (transaction.signature.length !== 3) {
        throw new Error(`Transaction file ${filepath} contains invalid signature format. Expected 3 elements [pubkey, r, s] for multisig.`);
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

    transactions.forEach(({ file, tx }) => {
        signatures.push(...tx.signature);
    });

    // Create Argent multisig format: [pubkey1, sig1_r, sig1_s, pubkey2, sig2_r, sig2_s, ...]
    const multisigSignature = [...signatures];

    console.log(`\n📊 Combined signature format:`);
    console.log(`  Signature count: ${transactions.length}`);
    console.log(`  Total elements: ${multisigSignature.length} (${transactions.length} signatures × 3 elements each)`);

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
        .argument('<signatureFiles...>', 'signed transaction files to combine')
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

