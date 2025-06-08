import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Starting EventFactory deployment...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("🔑 Deploying with account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // First deploy the library
  console.log("\n📦 Deploying EventFactoryLib...");
  const EventFactoryLib = await ethers.getContractFactory("EventFactoryLib");
  const eventFactoryLib = await EventFactoryLib.deploy() as any;
  await eventFactoryLib.waitForDeployment();
  
  const libAddress = await eventFactoryLib.getAddress();
  console.log("✅ EventFactoryLib deployed to:", libAddress);

  // Deploy EventFactory with library linking
  console.log("\n📦 Deploying EventFactory...");
  const EventFactory = await ethers.getContractFactory("EventFactory", {
    libraries: {
      EventFactoryLib: libAddress,
    },
  });
  
  // Use deployer as the initial platform fee recipient
  const eventFactory = await EventFactory.deploy(deployer.address) as any;
  await eventFactory.waitForDeployment();
  
  const factoryAddress = await eventFactory.getAddress();
  console.log("✅ EventFactory deployed to:", factoryAddress);

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
  console.log("📝 Contract Address:", factoryAddress);
  console.log("📚 Library Address:", libAddress);
  console.log("\n💡 Next steps:");
  console.log("1. Update your frontend to use this factory address");
  console.log("2. Use createEvent() function to create new events");
  console.log("3. Events will automatically deploy EventContract and EventTicketNFT");

  // Save deployment info
  const deploymentInfo = {
    network: await ethers.provider.getNetwork(),
    factoryAddress: factoryAddress,
    libraryAddress: libAddress,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    platformFee: Number(await eventFactory.platformFee()),
    platformFeeRecipient: await eventFactory.platformFeeRecipient()
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