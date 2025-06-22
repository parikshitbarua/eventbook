import { ethers } from "hardhat";

async function main() {
    console.log("🚀 Starting EventFactory deployment to Base Testnet with Clones pattern...");

    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);

    console.log("🔑 Deployer:", deployer.address);
    console.log("💰 Balance:", ethers.formatEther(balance), "ETH");

    // Deploy EventFactory (now includes implementation contracts automatically)
    console.log("\n📦 Deploying EventFactory with Clones pattern...");
    const EventFactory = await ethers.getContractFactory("EventFactory");

    const eventFactory = await EventFactory.deploy(deployer.address) as any;
    await eventFactory.waitForDeployment();
    const factoryAddress = await eventFactory.getAddress();

    console.log("✅ EventFactory deployed to:", factoryAddress);

    // Get implementation contract addresses
    const eventImplementation = await eventFactory.eventImplementation();
    const nftImplementation = await eventFactory.nftImplementation();
    
    console.log("✅ EventContract implementation deployed to:", eventImplementation);
    console.log("✅ EventTicketNFT implementation deployed to:", nftImplementation);

    // Show Factory info
    console.log("\n📊 Factory Info:");
    const platformFee = await eventFactory.platformFee();
    console.log("- Platform Fee:", platformFee.toString(), "bps");
    console.log("- Fee Recipient:", await eventFactory.platformFeeRecipient());
    console.log("- Event Counter:", await eventFactory.eventCounter());

    console.log("\n🎉 Base Testnet deployment completed successfully!");
    console.log("💡 Your frontend code remains unchanged - same API!");
    console.log("🚀 Now enjoy 90% gas savings on event creation!");

    const summary = {
        network: (await ethers.provider.getNetwork()).name,
        factoryAddress,
        eventImplementation,
        nftImplementation,
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
        platformFee: Number(platformFee),
        optimizationUsed: "OpenZeppelin Clones (EIP-1167)",
        gasSavings: "~90% reduction in event creation costs"
    };

    console.log("\n📄 Deployment Summary:\n", JSON.stringify(summary, null, 2));
}

main().catch((err) => {
    console.error("❌ Deployment failed:", err);
    process.exit(1);
});
