

import {
    CompiledContract,
    Call,
    Calldata,
    RawArgs
} from 'starknet';
import { ResourceBounds } from '@starknet-io/types-js';


/**
 * Configuration for a blockchain network chain
 * Contains RPC endpoints and contract deployment information
 */
export interface ChainConfig {
    /** RPC endpoint URL for connecting to the chain */
    rpc: string;
    /** Optional mapping of contract names to their deployment configurations */
    contracts?: Record<string, ContractConfig>;
    /** Universal deployer contract address for Starknet deployments */
    universalDeployerAddress?: string;
    /** Chain name identifier */
    name?: string;
}

/**
 * Configuration for a deployed contract
 * Stores deployment metadata and addresses
 */
export interface ContractConfig {
    /** On-chain address of the deployed contract */
    address?: string;
    /** Class hash of the contract implementation */
    classHash?: string;
    /** Transaction hash from the initial deployment */
    deploymentTransactionHash?: string;
    /** Transaction hash from the most recent upgrade */
    lastUpgradeTransactionHash?: string;
    /** Address of the account that deployed the contract */
    deployer?: string;
    /** Salt used for deterministic deployment */
    salt?: string;
    /** ISO timestamp of when the contract was deployed */
    deployedAt?: string;
    /** ISO timestamp of when the contract was declared */
    declaredAt?: string;
}

/**
 * Root configuration object containing all chain configurations
 */
export interface Config {
    /** Mapping of chain names to their configurations */
    chains: Record<string, ChainConfig>;
}

/**
 * Result returned after successful contract deployment
 */
export interface DeploymentResult {
    /** Address where the contract was deployed */
    contractAddress: string;
    /** Transaction hash of the deployment */
    transactionHash: string;
    /** Class hash of the deployed contract */
    classHash: string;
}

/**
 * Result returned after successful contract upgrade
 */
export interface UpgradeResult {
    /** Address of the upgraded contract */
    contractAddress: string;
    /** Transaction hash of the upgrade transaction */
    transactionHash: string;
    /** New class hash after upgrade */
    newClassHash: string;
}

/**
 * Result returned after successful contract declaration
 */
export interface DeclareResult {
    /** Class hash of the declared contract */
    classHash: string;
    /** Transaction hash of the declaration */
    transactionHash: string;
}

/**
 * Contract artifact containing compiled contract data
 * Used for declaring contracts on Starknet
 */
export interface ContractArtifact {
    /** Sierra compiled contract (high-level representation) */
    contract: CompiledContract;
    /** CASM compiled contract (Cairo assembly) */
    casm: CompiledContract;
}

/**
 * Base fields for all unsigned transactions
 */
interface BaseUnsignedTransaction {
    /** Transaction type (e.g., 'INVOKE', 'DECLARE', 'DEPLOY') */
    type: string;
    /** Transaction version (e.g., '0x3' for v3 transactions) */
    version: string;
    /** Address of the account sending the transaction */
    sender_address: string;
    /** Account nonce for transaction ordering */
    nonce: string;
    /** Gas limits and pricing for L1 and L2 */
    resource_bounds: ResourceBounds;
    /** Optional tip for block producers */
    tip: string;
    /** Data for paymaster sponsorship (if applicable) */
    paymaster_data: any[];
    /** Data availability mode for nonce (L1 or L2) */
    nonce_data_availability_mode: string;
    /** Data availability mode for fee (L1 or L2) */
    fee_data_availability_mode: string;
    /** Unix timestamp of transaction creation */
    timestamp: number;
}

/**
 * Unsigned invoke transaction for offline signing
 */
export interface UnsignedInvokeTransaction extends BaseUnsignedTransaction {
    type: 'INVOKE';
    /** Calldata array for the account's execute function */
    calldata: RawArgs | Calldata;
    /** Data for account deployment (if applicable) */
    account_deployment_data: any[];
    /** Original entrypoint name for Ledger signing (not included in final transaction) */
    entrypoint_name?: string;
    /** Original contract address for Ledger signing (not included in final transaction) */
    contract_address?: string;
    /** Original calls for multicall transactions (for Ledger display, not included in final transaction) */
    multicall_info?: MulticallEntry[];
}

/**
 * Unsigned declare transaction for offline signing
 */
export interface UnsignedDeclareTransaction extends BaseUnsignedTransaction {
    type: 'DECLARE';
    /** Contract class to declare */
    contract_class: CompiledContract;
    /** Compiled class hash */
    compiled_class_hash: string;
}

/**
 * Union type for all unsigned transactions
 * Note: Only invoke transactions are supported offline since declarations are done online only
 */
export type UnsignedTransaction = UnsignedInvokeTransaction;

/**
 * Options for generating unsigned transactions
 */
export interface GenerateUnsignedTxOptions {
    /** Account nonce for the transaction */
    nonce: string;
    /** Gas limits and pricing configuration */
    resourceBounds: ResourceBounds;
}

/**
 * Options for offline transaction generation
 * Used when creating transactions for hardware wallet signing
 */
export interface OfflineTransactionOptions {
    /** Current account nonce */
    nonce?: string;
    /** Account address that will sign the transaction */
    accountAddress?: string;
    /** Directory to save unsigned transaction files */
    outputDir?: string;
    /** Maximum L1 gas amount */
    l1GasMaxAmount?: string;
    /** Maximum L1 gas price per unit */
    l1GasMaxPricePerUnit?: string;
    /** Maximum L2 gas amount */
    l2GasMaxAmount?: string;
    /** Maximum L2 gas price per unit */
    l2GasMaxPricePerUnit?: string;
    /** Maximum L1 data amount */
    l1DataMaxAmount?: string;
    /** Maximum L1 data price per unit */
    l1DataMaxPricePerUnit?: string;
    /** Compiled class hash (required for declare transactions, computed with starkli) */
    compiledClassHash?: string;
    /** Whether offline mode is enabled */
    offline?: boolean;
}

/**
 * Result of offline transaction generation
 */
export interface OfflineTransactionResult {
    /** Indicates this was an offline operation */
    offline: boolean;
    /** Path to the saved transaction file */
    transactionFile: string;
}

/**
 * Base options for CLI commands
 * Common options available across all commands
 */
export interface BaseCommandOptions {
    /** Environment name (mainnet, testnet, devnet, stagenet) */
    env: string;
    /** Skip confirmation prompts */
    yes?: boolean;
}

/**
 * Options specific to Starknet operations
 * Extends base options with Starknet-specific parameters
 */
export interface StarknetCommandOptions extends BaseCommandOptions, OfflineTransactionOptions {
    /** Private key for transaction signing (testnet/devnet only) */
    privateKey?: string;
    /** Whether to add options for a specific feature */
    ignorePrivateKey?: boolean;
    /** Whether to ignore account address requirement */
    ignoreAccountAddress?: boolean;
    /** Whether to estimate gas for the transaction */
    estimate?: boolean;
}

/**
 * Options for contract declaration commands
 */
export interface DeclareContractOptions extends StarknetCommandOptions {
    /** Name to store in config for this contract */
    contractConfigName?: string;
    /** Path to the contract JSON file */
    contractPath?: string;
}

/**
 * Options for contract deployment commands
 */
export interface DeployContractOptions extends StarknetCommandOptions {
    /** Name of the contract configuration to use */
    contractConfigName?: string;
    /** JSON-encoded constructor arguments */
    constructorCalldata?: string;
    /** Salt for deterministic deployment addresses */
    salt?: string;
}

/**
 * Options for contract upgrade commands
 */
export interface UpgradeContractOptions extends StarknetCommandOptions {
    /** Name of the contract configuration to use */
    contractConfigName?: string;
    /** New class hash for the upgrade */
    classHash?: string;
    /** Contract address to upgrade (optional if already in config) */
    contractAddress?: string;
}

/**
 * Options for gateway contract interactions
 */
export interface GatewayCommandOptions extends StarknetCommandOptions {
    /** Destination chain for cross-chain calls */
    destinationChain?: string;
    /** Destination contract address */
    destinationContractAddress?: string;
    /** Payload data to send */
    payload?: string;
    /** Source chain for message validation */
    sourceChain?: string;
    /** Message identifier */
    messageId?: string;
    /** Source address for validation */
    sourceAddress?: string;
    /** Hash of the payload */
    payloadHash?: string;
    /** Contract address for message approval checks */
    contractAddress?: string;
    /** New operator address for transfers */
    newOperator?: string;
    /** Messages for approval */
    messages?: any[];
    /** Proof data for verification */
    proof?: any;
    /** New signers configuration */
    newSigners?: any;
}

/**
 * Options for governance contract interactions
 */
export interface GovernanceCommandOptions extends StarknetCommandOptions {
    /** Target contract address for proposals */
    target?: string;
    /** Entry point selector for contract calls */
    entryPointSelector?: string;
    /** Call data as JSON array */
    callData?: string;
    /** Native value to send with the call */
    nativeValue?: string;
    /** Hash for time lock or proposal lookups */
    hash?: string;
    /** Proposal hash for operator approvals */
    proposalHash?: string;
    /** Recipient address for withdrawals */
    recipient?: string;
    /** Amount for withdrawals */
    amount?: string;
    /** New operator address for transfers */
    newOperator?: string;
}

/**
 * Configuration for CLI command options
 * Used to dynamically add command-line flags
 */
export interface CliOptionConfig {
    /** Skip private key option */
    ignorePrivateKey?: boolean;
    /** Skip account address option */
    ignoreAccountAddress?: boolean;
    /** Is the command related to contract declaration? */
    declare?: boolean;
    /** Is the command related to contract deployment? */
    deployment?: boolean;
    /** Is the command related to upgrading a deployment? */
    upgrade?: boolean;
    /** Add contract address option */
    contractAddress?: boolean;
    /** Enable offline transaction support */
    offlineSupport?: boolean;
}

/**
 * Configuration for a single call in a multicall transaction
 */
export interface MulticallEntry {
    /** Contract address to call */
    contract_address: string;
    /** Function entrypoint to call */
    entrypoint: string;
    /** Calldata for the function call */
    calldata: string[];
}

/**
 * Configuration for multicall transactions
 * Loaded from JSON configuration file
 */
export interface MulticallConfig {
    /** Array of calls to execute in the multicall */
    calls: MulticallEntry[];
}

/**
 * Options for multicall command
 */
export interface MulticallCommandOptions extends StarknetCommandOptions {
    /** Path to the multicall configuration JSON file */
    config: string;
}

/**
 * Options for operators contract interactions
 */
export interface OperatorsCommandOptions extends StarknetCommandOptions {
    /** Account address to check operator status */
    account?: string;
    /** Operator address to add or remove */
    operator?: string;
    /** Target contract address for execute operations */
    target?: string;
    /** Function name for contract calls (will be converted to selector) */
    functionName?: string;
    /** Call data as JSON array or string */
    calldata?: string | string[];
    /** Native value to send with the call */
    nativeValue?: string;
}

/**
 * Options for gas service contract interactions
 */
export interface GasServiceCommandOptions extends StarknetCommandOptions {
    /** Action to perform */
    action?: string;
    /** Receiver address for collect and refund operations */
    receiverAddress?: string;
    /** Array of contracts and amounts for collect operation */
    contractsAmounts?: Array<{ contract_address: string; amount: string }>;
    /** Transaction hash for refund and add gas operations */
    txHash?: string;
    /** Log index for refund and add gas operations */
    logIndex?: number;
    /** Token address for operations */
    tokenAddress?: string;
    /** Amount for refund, add gas, and pay gas operations */
    amount?: string;
    /** Refund address for gas operations */
    refundAddress?: string;
    /** Destination chain for pay gas operation */
    destinationChain?: string;
    /** Destination address for pay gas operation */
    destinationAddress?: string;
    /** Payload hash for pay gas operation */
    payloadHash?: string;
    /** Additional parameters for pay gas operation */
    params?: string;
}

