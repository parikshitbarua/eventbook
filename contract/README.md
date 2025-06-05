# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
```

compile contract
```shell
npx hardhat compile
```

start local hardhat network
```shell
npx hardhat node
```

deploy contract to hardhat network
```shell
npx hardhat run scripts/deploy.ts --network localhost
```


