import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Starting EventFactory deployment with Clones pattern...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("🔑 Deploying with account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Deploy EventFactory (now includes implementation contracts automatically)
  console.log("\n📦 Deploying EventFactory with Clones pattern...");
  const EventFactory = await ethers.getContractFactory("EventFactory");
  
  // Use deployer as the initial platform fee recipient
  const eventFactory = await EventFactory.deploy(deployer.address) as any;
  await eventFactory.waitForDeployment();
  
  const factoryAddress = await eventFactory.getAddress();
  console.log("✅ EventFactory deployed to:", factoryAddress);

  // Get implementation contract addresses
  const eventImplementation = await eventFactory.eventImplementation();
  const nftImplementation = await eventFactory.nftImplementation();
  
  console.log("✅ EventContract implementation deployed to:", eventImplementation);
  console.log("✅ EventTicketNFT implementation deployed to:", nftImplementation);

  // Display factory details
  console.log("\n📊 Factory Details:");
  console.log("- Platform Fee:", await eventFactory.platformFee(), "basis points (", (Number(await eventFactory.platformFee()) / 100).toString(), "%)");
  console.log("- Platform Fee Recipient:", await eventFactory.platformFeeRecipient());
  console.log("- Event Counter:", await eventFactory.eventCounter());

  // Verify the deployment by checking some basic functions
  console.log("\n🔍 Verifying deployment...");
  const allEventIds = await eventFactory.getAllEventIds();
  console.log("- All Event IDs:", allEventIds);
  console.log("- Active Events:", await eventFactory.getActiveEvents());

  console.log("\n🎉 EventFactory deployment completed successfully!");
  console.log("📝 Factory Address:", factoryAddress);
  console.log("🔧 EventContract Implementation:", eventImplementation);
  console.log("🎫 EventTicketNFT Implementation:", nftImplementation);
  
  console.log("\n💡 Next steps:");
  console.log("1. Update your frontend to use this factory address");
  console.log("2. Use createEvent() function to create new events (same API!)");
  console.log("3. Events will automatically deploy minimal proxy clones");
  console.log("4. Enjoy 90% gas savings on event creation! 🎉");

  // Save deployment info
  const deploymentInfo = {
    network: await ethers.provider.getNetwork(),
    factoryAddress: factoryAddress,
    eventImplementation: eventImplementation,
    nftImplementation: nftImplementation,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    platformFee: Number(await eventFactory.platformFee()),
    platformFeeRecipient: await eventFactory.platformFeeRecipient(),
    optimizationUsed: "OpenZeppelin Clones (EIP-1167)",
    gasSavings: "~90% reduction in event creation costs"
  };

  console.log("\n📄 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 