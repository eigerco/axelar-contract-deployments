'use strict';

const axios = require('axios');
const { ethers } = require('hardhat');
const {
    ContractFactory,
    Contract,
    utils: {
        computeAddress,
        getContractAddress,
        keccak256,
        isAddress,
        getCreate2Address,
        defaultAbiCoder,
        isHexString,
        hexZeroPad,
        HDNode,
    },
    constants: { AddressZero, HashZero },
    getDefaultProvider,
    BigNumber,
    Wallet,
} = ethers;
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const {
    loadConfig,
    saveConfig,
    isNonEmptyString,
    isNonEmptyStringArray,
    isNumber,
    isNumberArray,
    isString,
    isValidNumber,
    isValidTimeFormat,
    printInfo,
    isValidDecimal,
    copyObject,
    printError,
    printWarn,
    writeJSON,
    httpGet,
    httpPost,
    sleep,
    findProjectRoot,
    timeout,
    getSaltFromKey,
    getCurrentVerifierSet,
} = require('../common');
const {
    create3DeployContract,
    deployContractConstant,
    predictContractConstant,
    getCreate3Address,
    printObj,
} = require('@axelar-network/axelar-gmp-sdk-solidity');
const CreateDeploy = require('@axelar-network/axelar-gmp-sdk-solidity/artifacts/contracts/deploy/CreateDeploy.sol/CreateDeploy.json');
const IDeployer = require('@axelar-network/axelar-gmp-sdk-solidity/interfaces/IDeployer.json');
const { exec } = require('child_process');
const { verifyContract } = require(`${__dirname}/../axelar-chains-config`);

const deployCreate = async (wallet, contractJson, args = [], options = {}, verifyOptions = null, chain = {}) => {
    const factory = new ContractFactory(contractJson.abi, contractJson.bytecode, wallet);

    const contract = await factory.deploy(...args, options);
    await contract.deployTransaction.wait(chain.confirmations);

    if (verifyOptions?.env) {
        sleep(10000);

        try {
            await verifyContract(verifyOptions.env, verifyOptions.chain, contract.address, args, verifyOptions);
        } catch (e) {
            console.log('FAILED VERIFICATION!!');
        }
    }

    return contract;
};

const deployCreate2 = async (
    constAddressDeployerAddress,
    wallet,
    contractJson,
    args = [],
    salt = Date.now(),
    gasOptions = null,
    verifyOptions = null,
    chain = {},
) => {
    let contract;

    if (!verifyOptions?.only) {
        contract = await deployContractConstant(
            constAddressDeployerAddress,
            wallet,
            contractJson,
            salt,
            args,
            gasOptions,
            chain.confirmations,
        );
    } else {
        contract = { address: await predictContractConstant(constAddressDeployerAddress, wallet, contractJson, salt, args) };
    }

    if (verifyOptions?.env) {
        sleep(2000);

        try {
            await verifyContract(verifyOptions.env, verifyOptions.chain, contract.address, args, verifyOptions);
        } catch (e) {
            console.log(`FAILED VERIFICATION!! ${e}`);
        }
    }

    return contract;
};

const deployCreate3 = async (
    create3DeployerAddress,
    wallet,
    contractJson,
    args = [],
    key = Date.now(),
    gasOptions = null,
    verifyOptions = null,
    chain = {},
) => {
    let contract;

    if (!verifyOptions?.only) {
        contract = await create3DeployContract(create3DeployerAddress, wallet, contractJson, key, args, gasOptions, chain.confirmations);
    } else {
        contract = { address: await getCreate3Address(create3DeployerAddress, wallet, key) };
    }

    if (verifyOptions?.env) {
        sleep(2000);

        try {
            await verifyContract(verifyOptions.env, verifyOptions.chain, contract.address, args, verifyOptions);
        } catch (e) {
            console.log(`FAILED VERIFICATION!! ${e}`);
        }
    }

    return contract;
};

const isAddressArray = (arr) => {
    if (!Array.isArray(arr)) return false;

    for (const item of arr) {
        if (!isAddress(item)) {
            return false;
        }
    }

    return true;
};

const isBytes32Array = (arr) => {
    if (!Array.isArray(arr)) {
        return false;
    }

    for (const item of arr) {
        if (typeof item !== 'string' || !item.startsWith('0x') || item.length !== 66) {
            return false;
        }
    }

    return true;
};

function isKeccak256Hash(input) {
    // Ensure it's a string of 66 characters length and starts with '0x'
    if (typeof input !== 'string' || input.length !== 66 || input.slice(0, 2) !== '0x') {
        return false;
    }

    // Ensure all characters after the '0x' prefix are hexadecimal (0-9, a-f, A-F)
    const hexPattern = /^[a-fA-F0-9]{64}$/;

    return hexPattern.test(input.slice(2));
}

function isValidCalldata(input) {
    if (input === '0x') {
        return true;
    }

    // Ensure it's a string, starts with '0x' and has an even number of characters after '0x'
    if (typeof input !== 'string' || input.slice(0, 2) !== '0x' || input.length % 2 !== 0) {
        return false;
    }

    // Ensure all characters after the '0x' prefix are hexadecimal (0-9, a-f, A-F)
    const hexPattern = /^[a-fA-F0-9]+$/;

    return hexPattern.test(input.slice(2));
}

function isValidBytesAddress(input) {
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    return addressRegex.test(input);
}

function isValidBytesArray(input) {
    if (input.length % 2 === 1) {
        return false;
    }

    const bytesRegex = /^0x[a-fA-F0-9]*/;
    return bytesRegex.test(input);
}

const isContract = async (address, provider) => {
    const code = await provider.getCode(address);
    return code && code !== '0x';
};

function isValidAddress(address, allowZeroAddress) {
    if (!allowZeroAddress && address === AddressZero) {
        return false;
    }

    return isAddress(address);
}

// Validate if the input privateKey is correct
function isValidPrivateKey(privateKey) {
    // Check if it's a valid hexadecimal string
    if (!privateKey?.startsWith('0x')) {
        privateKey = '0x' + privateKey;
    }

    if (!isHexString(privateKey) || privateKey.length !== 66) {
        return false;
    }

    return true;
}

function isValidTokenId(input) {
    if (!input?.startsWith('0x')) {
        return false;
    }

    const hexPattern = /^[0-9a-fA-F]+$/;

    if (!hexPattern.test(input.slice(2))) {
        return false;
    }

    const minValue = BigInt('0x00');
    const maxValue = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
    const numericValue = BigInt(input);

    return numericValue >= minValue && numericValue <= maxValue;
}

const validationFunctions = {
    isNonEmptyString,
    isNumber,
    isValidNumber,
    isValidDecimal,
    isNumberArray,
    isString,
    isNonEmptyStringArray,
    isAddress,
    isAddressArray,
    isKeccak256Hash,
    isValidCalldata,
    isValidBytesAddress,
    isValidTimeFormat,
    isContract,
    isValidAddress,
    isValidPrivateKey,
    isValidTokenId,
    isValidBytesArray,
};

function validateParameters(parameters) {
    for (const [validatorFunctionString, paramsObj] of Object.entries(parameters)) {
        const validatorFunction = validationFunctions[validatorFunctionString];

        if (typeof validatorFunction !== 'function') {
            throw new Error(`Validator function ${validatorFunction} is not defined`);
        }

        for (const paramKey of Object.keys(paramsObj)) {
            const paramValue = paramsObj[paramKey];
            if (paramValue === undefined) {
                throw new Error(`${paramKey} is not defined. Missing in the chain config.`);
            }
            const isValid = validatorFunction(paramValue);

            if (!isValid) {
                throw new Error(`Input validation failed for ${validatorFunctionString} with parameter ${paramKey}: ${paramValue}`);
            }
        }
    }
}

async function getBytecodeFromAddress(address, provider) {
    if (!provider) {
        throw new Error('Provider must be provided for address');
    }
    return await provider.getCode(address);
}

async function getBytecodeFromContractInstance(contractObject) {
    if (!contractObject.provider) {
        throw new Error('Contract instance must have a provider');
    }
    return await getBytecodeFromAddress(contractObject.address, contractObject.provider);
}

function getBytecodeFromDeployedBytecode(contractObject) {
    const deployedBytecode = contractObject.deployedBytecode;

    if (typeof deployedBytecode === 'string') {
        return deployedBytecode;
    } else if (typeof deployedBytecode === 'object' && deployedBytecode.object) {
        return deployedBytecode.object;
    } else {
        throw new Error('Invalid deployedBytecode format in contract JSON.');
    }
}

function getBytecodeFromBytecode(contractObject) {
    const bytecode = contractObject.bytecode;

    if (typeof bytecode === 'string') {
        return bytecode;
    } else if (typeof bytecode === 'object' && bytecode.object) {
        return bytecode.object;
    } else {
        throw new Error('Invalid bytecode format in contract JSON.');
    }
}

async function getBytecodeHash(contractObject, chain = '', provider = null) {
    let bytecode;

    if (isNonEmptyString(contractObject)) {
        bytecode = await getBytecodeFromAddress(contractObject, provider);
    } else if (contractObject.address) {
        // Contract instance
        bytecode = await getBytecodeFromContractInstance(contractObject);
    } else if (contractObject.deployedBytecode) {
        // Foundry outputs bytecode as an object with metadata, extract the actual bytecode
        bytecode = getBytecodeFromDeployedBytecode(contractObject);
    } else if (contractObject.bytecode) {
        bytecode = getBytecodeFromBytecode(contractObject);
    } else {
        throw new Error('Invalid contract object. Expected ethers.js Contract, ContractFactory, or contract JSON with bytecode.');
    }

    if (bytecode === '0x') {
        throw new Error('Contract bytecode is empty');
    }

    if (chain.toLowerCase() === 'polygon-zkevm') {
        throw new Error('polygon-zkevm uses a custom bytecode hash derivation and is not supported');
    }
    return keccak256(bytecode);
}

const predictAddressCreate = async (from, nonce) => {
    const address = getContractAddress({
        from,
        nonce,
    });

    return address;
};

const getDeployOptions = (deployMethod, salt, chain) => {
    let deployer;

    if (deployMethod === 'create') {
        return {};
    }

    if (deployMethod === 'create2') {
        deployer = chain.contracts.ConstAddressDeployer?.address || chain.contracts.Create2Deployer?.address;
    } else {
        deployer = chain.contracts.Create3Deployer?.address;
    }

    if (!isValidAddress(deployer)) {
        throw new Error('ConstAddressDeployer address is not valid');
    }

    if (!isNonEmptyString(salt)) {
        throw new Error('Salt was not provided');
    }

    return {
        salt,
        deployerContract: deployer,
    };
};

const getDeployedAddress = async (deployer, deployMethod, options = {}) => {
    switch (deployMethod) {
        case 'create': {
            let nonce = options.nonce;

            if (!nonce && !options.offline) {
                nonce = await options.provider.getTransactionCount(deployer);
            } else if (!isNumber(nonce)) {
                throw new Error('Nonce must be provided for create deployment');
            }

            return getContractAddress({
                from: deployer,
                nonce,
            });
        }

        case 'create2': {
            let salt = getSaltFromKey(options.salt);

            const deployerContract = options.deployerContract;

            if (!isNonEmptyString(deployerContract)) {
                throw new Error('Deployer contract address was not provided');
            }

            const contractJson = options.contractJson;
            const constructorArgs = options.constructorArgs;
            const factory = new ContractFactory(contractJson.abi, contractJson.bytecode);
            const initCode = factory.getDeployTransaction(...constructorArgs).data;

            if (!options.offline) {
                const deployerInterface = new Contract(deployerContract, IDeployer.abi, options.provider);

                return deployerInterface.deployedAddress(initCode, deployer, salt);
            }

            salt = keccak256(defaultAbiCoder.encode(['address', 'bytes32'], [deployer, salt]));

            return getCreate2Address(deployerContract, salt, keccak256(initCode));
        }

        case 'create3': {
            const deployerContract = options.deployerContract;

            if (!isNonEmptyString(deployerContract)) {
                throw new Error('Deployer contract address was not provided');
            }

            if (!options.offline) {
                const salt = getSaltFromKey(options.salt);

                const deployerInterface = new Contract(deployerContract, IDeployer.abi, options.provider);

                return deployerInterface.deployedAddress('0x', deployer, salt);
            }

            const createDeployer = await getDeployedAddress(deployer, 'create2', {
                salt: options.salt,
                deployerContract,
                contractJson: CreateDeploy,
                constructorArgs: [],
            });

            const contractAddress = getContractAddress({
                from: createDeployer,
                nonce: 1,
            });

            return contractAddress;
        }

        default: {
            throw new Error(`Invalid deployment method: ${deployMethod}`);
        }
    }
};

const getProxy = async (axelar, chain) => {
    const address = (await httpGet(`${axelar.lcd}/axelar/evm/v1beta1/gateway_address/${chain}`)).address;
    return address;
};

const getEVMBatch = async (axelar, chain, batchID = '') => {
    const batch = await httpGet(`${axelar.lcd}/axelar/evm/v1beta1/batched_commands/${chain}/${batchID}`);
    return batch;
};

const getAmplifierVerifiers = async (axelar, chain) => {
    const { verifierSetId, verifierSet, signers } = await getCurrentVerifierSet(axelar, chain);

    const weightedAddresses = signers
        .map((signer) => ({
            address: computeAddress(`0x${signer.pub_key.ecdsa}`),
            weight: signer.weight,
        }))
        .sort((a, b) => a.address.localeCompare(b.address));

    return { addresses: weightedAddresses, threshold: verifierSet.threshold, created_at: verifierSet.created_at, verifierSetId };
};

const getEVMAddresses = async (axelar, chain, options = {}) => {
    const keyID = options.keyID || '';

    if (isAddress(keyID)) {
        return { addresses: [keyID], weights: [Number(1)], threshold: 1, keyID: 'debug' };
    }

    const evmAddresses = options.amplifier
        ? await getAmplifierVerifiers(axelar, chain)
        : await httpGet(`${axelar.lcd}/axelar/evm/v1beta1/key_address/${chain}?key_id=${keyID}`);

    const sortedAddresses = evmAddresses.addresses.sort((a, b) => a.address.toLowerCase().localeCompare(b.address.toLowerCase()));

    const addresses = sortedAddresses.map((weightedAddress) => weightedAddress.address);
    const weights = sortedAddresses.map((weightedAddress) => Number(weightedAddress.weight));
    const threshold = Number(evmAddresses.threshold);

    return { addresses, weights, threshold, keyID: evmAddresses.key_id };
};

function loadParallelExecutionConfig(env, chain) {
    return require(`${__dirname}/../chains-info/${env}-${chain}.json`);
}

function saveParallelExecutionConfig(config, env, chain) {
    writeJSON(config, `${__dirname}/../chains-info/${env}-${chain}.json`);
}

async function printWalletInfo(wallet, options = {}, chain = {}) {
    let balance = 0;
    const address = await wallet.getAddress();
    printInfo('Wallet address', address);

    if (!options.offline) {
        balance = await wallet.provider.getBalance(address);

        if (balance.isZero()) {
            printError('Wallet balance', '0');
        } else {
            printInfo('Wallet balance', `${balance / 1e18} ${chain.tokenSymbol || ''}`);
        }

        printInfo('Wallet nonce', (await wallet.provider.getTransactionCount(address)).toString());
    }

    return { address, balance };
}

const deployContract = async (
    deployMethod,
    wallet,
    contractJson,
    constructorArgs,
    deployOptions = {},
    gasOptions = {},
    verifyOptions = {},
    chain = {},
) => {
    const predictedAddress = await getDeployedAddress(wallet.address, deployMethod, {
        salt: deployOptions.salt,
        deployerContract: deployOptions.deployerContract,
        contractJson,
        constructorArgs,
        provider: wallet.provider,
    });

    if (await isContract(predictedAddress, wallet.provider)) {
        printError(`Contract is already deployed at ${predictedAddress}, skipping`);
        return new Contract(predictedAddress, contractJson.abi, wallet);
    }

    switch (deployMethod) {
        case 'create': {
            const contract = await deployCreate(wallet, contractJson, constructorArgs, gasOptions, verifyOptions, chain);
            return contract;
        }

        case 'create2': {
            if (!isNonEmptyString(deployOptions.deployerContract)) {
                throw new Error('Deployer contract address was not provided');
            }

            if (!isNonEmptyString(deployOptions.salt)) {
                throw new Error('Salt was not provided');
            }

            const contract = await deployCreate2(
                deployOptions.deployerContract,
                wallet,
                contractJson,
                constructorArgs,
                deployOptions.salt,
                gasOptions,
                verifyOptions,
                chain,
            );

            return contract;
        }

        case 'create3': {
            if (!isNonEmptyString(deployOptions.deployerContract)) {
                throw new Error('Deployer contract address was not provided');
            }

            if (!isNonEmptyString(deployOptions.salt)) {
                throw new Error('Salt was not provided');
            }

            const contract = await deployCreate3(
                deployOptions.deployerContract,
                wallet,
                contractJson,
                constructorArgs,
                deployOptions.salt,
                gasOptions,
                verifyOptions,
                chain,
            );

            return contract;
        }

        default: {
            throw new Error(`Invalid deployment method: ${deployMethod}`);
        }
    }
};

function wasEventEmitted(receipt, contract, eventName) {
    const event = contract.filters[eventName]();

    return receipt.logs.some((log) => log.topics[0] === event.topics[0]);
}

const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));

const mainProcessor = async (options, processCommand, save = true, catchErr = false) => {
    if (!options.env) {
        throw new Error('Environment was not provided');
    }

    printInfo('Environment', options.env);

    const config = loadConfig(options.env);
    const chainsToSkip = (options.skipChains || '').split(',').map((str) => str.trim().toLowerCase());

    let chains = [];

    if (options.chainNames === 'all') {
        chains = Object.keys(config.chains);
        chains = chains.filter((chain) => !config.chains[chain].chainType || config.chains[chain].chainType === 'evm');
    } else if (options.chainNames) {
        chains = options.chainNames.split(',');
        chains.forEach((chain) => {
            if (config.chains[chain].chainType && config.chains[chain].chainType !== 'evm') {
                throw new Error(`Cannot run script for a non EVM chain: ${chain}`);
            }
        });
    }

    if (chains.length === 0) {
        throw new Error('Chain names were not provided');
    }

    chains = chains.map((chain) => chain.trim().toLowerCase());

    if (options.startFromChain) {
        const startIndex = chains.findIndex((chain) => chain === options.startFromChain.toLowerCase());

        if (startIndex === -1) {
            throw new Error(`Chain ${options.startFromChain} is not defined in the info file`);
        }

        chains = chains.slice(startIndex);
    }

    for (const chainName of chains) {
        if (config.chains[chainName.toLowerCase()] === undefined) {
            throw new Error(`Chain ${chainName} is not defined in the info file`);
        }
    }

    if (options.parallel && chains.length > 1) {
        const cmds = process.argv.filter((command) => command);
        let chainCommandIndex = -1;
        let skipPrompt = false;

        for (let commandIndex = 0; commandIndex < cmds.length; commandIndex++) {
            const cmd = cmds[commandIndex];

            if (cmd === '-n' || cmd === '--chainName' || cmd === '--chainNames') {
                chainCommandIndex = commandIndex;
            } else if (cmd === '--parallel') {
                cmds[commandIndex] = '--saveChainSeparately';
            } else if (cmd === '-y' || cmd === '--yes') {
                skipPrompt = true;
            }
        }

        if (!skipPrompt) {
            cmds.push('-y');
        }

        const successfullChains = [];

        const executeChain = (chainName) => {
            const chain = config.chains[chainName.toLowerCase()];

            if (chainsToSkip.includes(chain.name.toLowerCase()) || chain.status === 'deactive') {
                printWarn('Skipping chain', chain.name);
                return Promise.resolve();
            }

            return new Promise((resolve) => {
                cmds[chainCommandIndex + 1] = chainName;

                exec(cmds.join(' '), { stdio: 'inherit' }, (error, stdout) => {
                    printInfo('-------------------------------------------------------');
                    printInfo(`Logs for ${chainName}`, stdout);

                    if (error) {
                        printError(`Error while running script for ${chainName}`, error);
                    } else {
                        successfullChains.push(chainName);
                        printInfo(`Finished running script for chain`, chainName);
                    }

                    resolve();
                });
            });
        };

        await Promise.all(chains.map(executeChain));

        if (save) {
            for (const chainName of successfullChains) {
                config.chains[chainName.toLowerCase()] = loadParallelExecutionConfig(options.env, chainName);
            }

            saveConfig(config, options.env);
        }

        return;
    }

    const chainsDeepCopy = deepCopy(config.chains);

    let results = [];
    for (const chainName of chains) {
        const chain = config.chains[chainName.toLowerCase()];

        if (chainsToSkip.includes(chain.name.toLowerCase()) || chain.status === 'deactive') {
            printWarn('Skipping chain', chain.name);
            continue;
        }

        console.log('');
        printInfo('Chain', chain.name, chalk.cyan);

        try {
            const result = await processCommand(config.axelar, chain, chainsDeepCopy, options);

            if (result) {
                results.push(result);
            }
        } catch (error) {
            printError(`Failed with error on ${chain.name}`, error.message);

            if (!catchErr && !options.ignoreError) {
                throw error;
            }
        }

        if (save) {
            if (options.saveChainSeparately) {
                saveParallelExecutionConfig(config.chains[chainName.toLowerCase()], options.env, chainName);
            } else {
                saveConfig(config, options.env);
            }
        }
    }

    return results;
};

function getConfigByChainId(chainId, config) {
    for (const chain of Object.values(config.chains)) {
        if (chain.chainId === chainId) {
            return chain;
        }
    }

    throw new Error(`Chain with chainId ${chainId} not found in the config`);
}

function findContractPath(dir, contractName) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat && stat.isDirectory()) {
            const recursivePath = findContractPath(filePath, contractName);

            if (recursivePath) {
                return recursivePath;
            }
        } else if (file === `${contractName}.json`) {
            return filePath;
        }
    }
}

function getContractPath(contractName) {
    const searchDirs = [
        path.join(findProjectRoot(__dirname), 'node_modules', '@axelar-network', 'axelar-gmp-sdk-solidity', 'artifacts', 'contracts'),
        path.join(findProjectRoot(__dirname), 'node_modules', '@axelar-network', 'axelar-cgp-solidity', 'artifacts', 'contracts'),
        path.join(findProjectRoot(__dirname), 'node_modules', '@axelar-network', 'interchain-token-service', 'artifacts', 'contracts'),
        path.join(findProjectRoot(__dirname), 'evm', 'legacy'),
    ];

    for (const dir of searchDirs) {
        if (fs.existsSync(dir)) {
            const contractPath = findContractPath(dir, contractName);

            if (contractPath) {
                return contractPath;
            }
        }
    }

    throw new Error(`Contract path for ${contractName} must be entered manually.`);
}

function normalizeContractJSON(contractJson, contractName) {
    // Handle Foundry JSON format which doesn't have contractName and sourceName
    if (!contractJson.contractName && contractJson.abi) {
        contractJson.contractName = contractName;
        contractJson.sourceName = `${contractName}.sol`;
    }

    if (contractJson.bytecode && typeof contractJson.bytecode === 'object' && contractJson.bytecode.object) {
        contractJson.bytecode = contractJson.bytecode.object;
    }

    if (contractJson.deployedBytecode && typeof contractJson.deployedBytecode === 'object' && contractJson.deployedBytecode.object) {
        contractJson.deployedBytecode = contractJson.deployedBytecode.object;
    }

    return contractJson;
}

function getContractJSON(contractName, artifactPath) {
    let contractPath;

    if (artifactPath) {
        contractPath = artifactPath.endsWith('.json') ? artifactPath : artifactPath + contractName + '.sol/' + contractName + '.json';
    } else {
        contractPath = getContractPath(contractName);
    }

    try {
        const contractJson = require(contractPath);
        return normalizeContractJSON(contractJson, contractName);
    } catch (err) {
        throw new Error(`Failed to load contract JSON for ${contractName} at path ${contractPath} with error: ${err}`);
    }
}

function getQualifiedContractName(contractName) {
    const contractJSON = getContractJSON(contractName);
    return `${contractJSON.sourceName}:${contractJSON.contractName}`;
}

async function getGasOptions(chain, options, contractName, defaultGasOptions = {}) {
    const { offline, gasOptions: gasOptionsCli } = options;
    const contractConfig = contractName ? chain?.contracts[contractName] : null;

    let gasOptions;

    if (gasOptionsCli) {
        try {
            gasOptions = JSON.parse(gasOptionsCli);
        } catch (error) {
            throw new Error(`Invalid gas options override: ${gasOptionsCli}`);
        }
    } else if (offline) {
        gasOptions = copyObject(contractConfig?.staticGasOptions || chain?.staticGasOptions || defaultGasOptions);
    } else {
        gasOptions = copyObject(contractConfig?.gasOptions || chain?.gasOptions || defaultGasOptions);
    }

    validateGasOptions(gasOptions);
    gasOptions = await handleGasPriceAdjustment(chain, gasOptions);

    printInfo('Gas options', JSON.stringify(gasOptions, null, 2));

    return gasOptions;
}

async function handleGasPriceAdjustment(chain, gasOptions) {
    const gasPriceAdjustment = gasOptions.gasPriceAdjustment;

    if (gasPriceAdjustment && !gasOptions.gasPrice) {
        try {
            const provider = getDefaultProvider(chain.rpc);
            gasOptions.gasPrice = Math.floor((await provider.getGasPrice()) * gasPriceAdjustment);
        } catch (err) {
            throw new Error(`Provider failed to retrieve gas price on chain ${chain.name}: ${err}`);
        }
    }

    if (gasPriceAdjustment) {
        delete gasOptions.gasPriceAdjustment;
    }

    return gasOptions;
}

function validateGasOptions(gasOptions) {
    const allowedFields = ['gasLimit', 'gasPrice', 'maxPriorityFeePerGas', 'maxFeePerGas', 'gasPriceAdjustment'];

    for (const [key, value] of Object.entries(gasOptions)) {
        if (!allowedFields.includes(key)) {
            throw new Error(`Invalid gas option field: ${key}`);
        }

        if (!isValidNumber(value)) {
            throw new Error(`Invalid ${key} value: ${value}`);
        }
    }
}

function validateChain(chains, chainName) {
    const validChain = Object.values(chains).some((chainObject) => chainObject.axelarId === chainName);

    if (!validChain) {
        throw new Error(`Invalid destination chain: ${chainName}`);
    }
}

async function relayTransaction(options, chain, contract, method, params, nativeValue = 0, gasOptions = {}, expectedEvent = null) {
    if (options.relayerAPI) {
        const result = await httpPost(options.relayerAPI, {
            chain: chain.axelarId,
            to: contract.address,
            calldata: contract.interface.encodeFunctionData(method, params),
            value: nativeValue.toString(),
        });

        if (!result.error) {
            printInfo('Relay ID', result.relayId);
        } else {
            throw new Error(`Relay Error: ${result.error}`);
        }

        return;
    }

    await timeout(
        (async () => {
            const tx = await contract[method](...params, gasOptions);
            printInfo('Tx hash', tx.hash);

            const receipt = await tx.wait(chain.confirmations);

            if (expectedEvent) {
                const eventEmitted = wasEventEmitted(receipt, contract, expectedEvent);

                if (!eventEmitted) {
                    printWarn('Event not emitted in receipt.');
                }
            }
        })(),

        chain.txTimeout || 60000,
        new Error(`Timeout updating gas info for ${chain.name}`),
    );
}

async function getDeploymentTx(apiUrl, apiKey, tokenAddress) {
    apiUrl = `${apiUrl}?module=contract&action=getcontractcreation&contractaddresses=${tokenAddress}&apikey=${apiKey}`;

    try {
        const response = await axios.get(apiUrl);
        return response.data.result[0].txHash;
    } catch (error) {
        printWarn(`Error fetching deployment tx for token ${tokenAddress}:`, error);
    }

    throw new Error('Deployment transaction not found.');
}

async function getWeightedSigners(axelar, chain, options) {
    let signers;
    let verifierSetId;

    if (isValidAddress(options.keyID)) {
        // set the keyID as the signer for debug deployments
        signers = {
            signers: [
                {
                    signer: options.keyID,
                    weight: 1,
                },
            ],
            threshold: 1,
            nonce: HashZero,
        };
    } else {
        const addresses = await getAmplifierVerifiers(axelar, chain.axelarId);
        const nonce = hexZeroPad(BigNumber.from(addresses.created_at).toHexString(), 32);

        signers = {
            signers: addresses.addresses.map(({ address, weight }) => ({ signer: address, weight: Number(weight) })),
            threshold: Number(addresses.threshold),
            nonce,
        };

        verifierSetId = addresses.verifierSetId;
    }

    return { signers: [signers], verifierSetId };
}

// Verify contract using it's source code path. The path is retrieved dynamically by the name.
const verifyContractByName = (env, chain, name, contract, args, options = {}) => {
    verifyContract(env, chain, contract, args, { ...options, contractPath: getQualifiedContractName(name) });
};

const isConsensusChain = (chain) => chain.contracts.AxelarGateway?.connectionType !== 'amplifier';

const isHyperliquidChain = (chain) => chain.axelarId.toLowerCase().includes('hyperliquid');

const INTERCHAIN_TRANSFER = 'interchainTransfer(bytes32,string,bytes,uint256,bytes,uint256)';
const INTERCHAIN_TRANSFER_WITH_METADATA = 'interchainTransfer(bytes32,string,bytes,uint256,bytes,uint256)';

const deriveAccounts = async (mnemonic, quantity) => {
    const hdNode = HDNode.fromMnemonic(mnemonic);
    const accounts = [];

    for (let i = 0; i < quantity; i++) {
        const path = `m/44'/60'/0'/0/${i}`;
        const derivedNode = hdNode.derivePath(path);

        const wallet = new Wallet(derivedNode.privateKey);

        accounts.push({
            address: wallet.address,
            privateKey: wallet.privateKey,
        });
    }

    return accounts;
};

async function printTokenInfo(tokenAddress, provider) {
    try {
        const token = new Contract(tokenAddress, getContractJSON('InterchainToken').abi, provider);
        const [name, symbol, decimals] = await Promise.all([token.name(), token.symbol(), token.decimals()]);

        printInfo(`Token name`, name);
        printInfo(`Token symbol`, symbol);
        printInfo(`Token decimals`, decimals);

        return { name, symbol, decimals };
    } catch (error) {
        printError(`Could not fetch token information for ${tokenAddress}: ${error.message}`);
        throw error;
    }
}

module.exports = {
    ...require('../common/utils'),
    deployCreate,
    deployCreate2,
    deployCreate3,
    deployContract,
    printObj,
    getBytecodeHash,
    predictAddressCreate,
    getDeployedAddress,
    isAddressArray,
    isKeccak256Hash,
    isValidCalldata,
    isValidBytesAddress,
    validateParameters,
    getProxy,
    getEVMBatch,
    getEVMAddresses,
    getConfigByChainId,
    printWalletInfo,
    wasEventEmitted,
    isContract,
    isValidAddress,
    isValidPrivateKey,
    isValidTokenId,
    verifyContract,
    mainProcessor,
    getContractPath,
    getContractJSON,
    normalizeContractJSON,
    isBytes32Array,
    getGasOptions,
    getSaltFromKey,
    getDeployOptions,
    validateChain,
    relayTransaction,
    getDeploymentTx,
    getWeightedSigners,
    getQualifiedContractName,
    verifyContractByName,
    isConsensusChain,
    isHyperliquidChain,
    INTERCHAIN_TRANSFER,
    INTERCHAIN_TRANSFER_WITH_METADATA,
    deriveAccounts,
    printTokenInfo,
};
