require('@nomicfoundation/hardhat-toolbox');
require('@nomiclabs/hardhat-ethers');
require('@typechain/hardhat');

const { importNetworks, readJSON } = require(`${__dirname}/axelar-chains-config`);

const env = process.env.NETWORK || 'testnet';
const chains = readJSON(`${__dirname}/axelar-chains-config/info/${env}.json`);
const keys = readJSON(`${__dirname}/keys.json`);
const { networks, etherscan } = importNetworks(chains, keys);

networks.hardhat.hardfork = process.env.EVM_VERSION || 'merge';

const config = {
    solidity: {
        version: '0.8.21',
        settings: {
            evmVersion: process.env.EVM_VERSION || 'london',
            optimizer: {
                enabled: true,
                runs: 1000000,
                details: {
                    peephole: process.env.COVERAGE === undefined,
                    inliner: process.env.COVERAGE === undefined,
                    jumpdestRemover: true,
                    orderLiterals: true,
                    deduplicate: true,
                    cse: process.env.COVERAGE === undefined,
                    constantOptimizer: true,
                    yul: true,
                    yulDetails: {
                        stackAllocation: true,
                    },
                },
            },
        },
    },
    defaultNetwork: 'hardhat',
    networks,
    etherscan,
    mocha: {
        timeout: 1000000,
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS !== '',
    },
};

module.exports = config;
