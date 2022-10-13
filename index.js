const { ethers } = require("ethers");

class OpenDSUEth {
    constructor(config) {
        this.provider = new ethers.providers.JsonRpcProvider(config.networkUrl);
        this.config = config;
        this.contracts = {};
    }

    createCryptoWallet() {
        const wallet = ethers.Wallet.createRandom();
        return {
            address: wallet.address,
            mnemonicPhrase: wallet.mnemonic.phrase,
            mnemonicPath: wallet.mnemonic.path,
            publicKey: wallet.publicKey,
            privateKey: wallet.privateKey,
        };
    }

    async getContract(contractAddress) {
        let contract = this.contracts[contractAddress];
        if (contract) {
            return contract;
        }

        const contractConfig = this.config.contracts.find((x) => x.address === contractAddress);
        if (!contractConfig) {
            throw new Error(`No contract registered for address ${contractAddress}!`);
        }

        const opendsu = "opendsu";
        const httpApi = require(opendsu).loadApi("http");
        const contractUrl = `${this.config.baseUrl}/external-volume/contracts/${contractConfig.name}.json`;
        const contractResponse = await httpApi.fetch(contractUrl);
        if (!contractResponse.ok) {
            throw new Error(`Failed to load contract ${contractConfig.name} for address ${contractAddress}!`);
        }

        const contractContent = await contractResponse.json();
        contract = new ethers.Contract(contractAddress, contractContent.abi, this.provider);
        this.contracts[contractAddress] = contract;

        return contract;
    }

    async callReadMethod(smartContractId, method, ...args) {
        const contract = await this.getContract(smartContractId);
        return contract[method].call(contract, ...args);
    }

    async callWriteMethod(keySSI, smartContractId, method, ...args) {
        const contract = await this.getContract(smartContractId);

        const signer = new ethers.Wallet(keySSI, this.provider);
        const signerContract = contract.connect(signer);

        const transaction = await signerContract[method].call(contract, ...args);
        const receipt = await transaction.wait();
        return receipt;
    }
}


function createStrategyFactory(config) {
    return new OpenDSUEth(config);
}

module.exports = {
    createStrategyFactory,
};
