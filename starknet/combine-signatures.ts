

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { shortString, hash } from 'starknet';
import { UnsignedTransaction } from './types';

interface SignedTransaction extends UnsignedTransaction {
    signature: string[];
}

interface SignerData {
    signerType: string;
    pubkey: string;
    r: string;
    s: string;
    guid: string;
    file: string;
}

/**
 * Calculate GUID for Starknet signer using Poseidon hash
 */
function calculateStarknetSignerGuid(pubkey: string): string {
    // GUID = poseidon('Starknet Signer', signer.pubkey)
    const starknetSignerString = 'Starknet Signer';
    return hash.computePoseidonHash(shortString.encodeShortString(starknetSignerString), pubkey);
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

    // Check signature format - new v0.2.0 format: [array_length, signer_type, pubkey, r, s]
    if (transaction.signature.length !== 5) {
        throw new Error(`Transaction file ${filepath} contains invalid signature format. Expected 5 elements [array_length, signer_type, pubkey, r, s] for v0.2.0 multisig.`);
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

    // Deep compare calldata
    if (JSON.stringify(tx1.calldata) !== JSON.stringify(tx2.calldata)) {
        throw new Error(`Transaction calldata mismatch between ${file1} and ${file2}`);
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

    // Extract all signatures and prepare for sorting
    console.log('\n📝 Extracting signatures and calculating GUIDs...');

    const signers: SignerData[] = [];
    let totalArrayLength = 0;

    transactions.forEach(({ file, tx }) => {
        const [arrayLength, signerType, pubkey, r, s] = tx.signature;

        // Only support Starknet signers for now
        if (signerType !== '0') {
            throw new Error(`Unsupported signer type ${signerType} in file ${file}. Only Starknet signers (type 0) are supported.`);
        }

        totalArrayLength += parseInt(arrayLength);

        // Calculate GUID for sorting
        const guid = calculateStarknetSignerGuid(pubkey);

        signers.push({
            signerType,
            pubkey,
            r,
            s,
            guid,
            file: path.basename(file)
        });

        console.log(`  ${path.basename(file)}: array_length=${arrayLength}, guid=${guid}`);
    });

    // Sort signers by GUID in ascending order (required by Argent multisig)
    console.log('\n🔄 Sorting signers by GUID...');
    signers.sort((a, b) => {
        // Convert hex strings to BigInt for proper comparison
        const guidA = BigInt(a.guid);
        const guidB = BigInt(b.guid);
        if (guidA < guidB) return -1;
        if (guidA > guidB) return 1;
        return 0;
    });

    // Display sorted order
    signers.forEach((signer, index) => {
        console.log(`  ${index + 1}. ${signer.file} (GUID: ${signer.guid})`);
    });

    // Create new v0.2.0 multisig format: [total_array_length, signer_type1, pubkey1, r1, s1, signer_type2, pubkey2, r2, s2, ...]
    const signerData: string[] = [];
    signers.forEach(signer => {
        signerData.push(signer.signerType, signer.pubkey, signer.r, signer.s);
    });

    const multisigSignature = [totalArrayLength.toString(), ...signerData];

    console.log(`\n📊 Combined signature format:`);
    console.log(`  Signature count: ${transactions.length}`);
    console.log(`  Total array length: ${totalArrayLength}`);
    console.log(`  Total elements: ${multisigSignature.length} (1 array length + ${transactions.length} signatures × 4 elements each)`);

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
    } catch (error) {
        console.error('\n❌ Failed to combine signatures:', error instanceof Error ? error.message : String(error));
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

