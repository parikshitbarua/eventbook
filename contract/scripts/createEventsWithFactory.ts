import { ethers } from "hardhat";

async function main() {
  console.log("🎪 Creating events using EventFactory...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("🔑 Account:", deployer.address);
  console.log("💰 Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Replace with your deployed EventFactory address
  const FACTORY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  
  // Library address from deployment
  const LIB_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  
  // Get the factory contract with library linking
  const EventFactory = await ethers.getContractFactory("EventFactory", {
    libraries: {
      EventFactoryLib: LIB_ADDRESS,
    },
  });
  const factory = EventFactory.attach(FACTORY_ADDRESS) as any;

  // Sample event data
  const events = [
    {
      title: "Summer Music Festival 2024",
      description: "The biggest music festival of the summer featuring top artists from around the world.",
      ticketPrice: ethers.parseEther("0.1"),
      maxTickets: 1000,
      eventURI: "https://example.com/events/summer-festival-2024",
      eventStartTime: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days from now
      eventEndTime: Math.floor(Date.now() / 1000) + 9 * 24 * 60 * 60, // 9 days from now
      venue: "Central Park, New York",
      nftName: "Summer Festival 2024 Tickets",
      nftSymbol: "SF2024"
    },
    {
      title: "Tech Conference 2024",
      description: "Annual technology conference featuring cutting-edge innovations and industry leaders.",
      ticketPrice: ethers.parseEther("0.05"),
      maxTickets: 500,
      eventURI: "https://example.com/events/tech-conference-2024",
      eventStartTime: Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60, // 14 days from now
      eventEndTime: Math.floor(Date.now() / 1000) + 16 * 24 * 60 * 60, // 16 days from now
      venue: "Convention Center, San Francisco",
      nftName: "Tech Conference 2024 Passes",
      nftSymbol: "TECH2024"
    },
    {
      title: "Art Gallery Opening",
      description: "Exclusive opening of contemporary art gallery featuring emerging artists.",
      ticketPrice: ethers.parseEther("0.02"),
      maxTickets: 200,
      eventURI: "https://example.com/events/art-gallery-opening",
      eventStartTime: Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60, // 5 days from now
      eventEndTime: Math.floor(Date.now() / 1000) + 5 * 24 * 60 * 60 + 6 * 60 * 60, // 6 hours duration
      venue: "Modern Art Gallery, London",
      nftName: "Art Gallery Opening Tickets",
      nftSymbol: "ART2024"
    },
    {
      title: "Food & Wine Festival",
      description: "Gourmet food and wine tasting event with world-renowned chefs and vintners.",
      ticketPrice: ethers.parseEther("0.08"),
      maxTickets: 300,
      eventURI: "https://example.com/events/food-wine-festival",
      eventStartTime: Math.floor(Date.now() / 1000) + 21 * 24 * 60 * 60, // 21 days from now
      eventEndTime: Math.floor(Date.now() / 1000) + 23 * 24 * 60 * 60, // 23 days from now
      venue: "Napa Valley, California",
      nftName: "Food & Wine Festival Tickets",
      nftSymbol: "FWF2024"
    },
    {
      title: "Charity Gala Dinner",
      description: "Annual charity gala dinner supporting local community programs and initiatives.",
      ticketPrice: ethers.parseEther("0.15"),
      maxTickets: 150,
      eventURI: "https://example.com/events/charity-gala-dinner",
      eventStartTime: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days from now
      eventEndTime: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 + 4 * 60 * 60, // 4 hours duration
      venue: "Grand Ballroom, Hotel Imperial, Paris",
      nftName: "Charity Gala Dinner Tickets",
      nftSymbol: "GALA2024"
    }
  ];

  console.log(`\n🎯 Creating ${events.length} events...\n`);

  const createdEvents = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    
    try {
      console.log(`📅 Creating Event ${i + 1}: ${event.title}`);
      
      const tx = await factory.createEvent(
        event.title,
        event.description,
        event.ticketPrice,
        event.maxTickets,
        event.eventURI,
        event.eventStartTime,
        event.eventEndTime,
        event.venue,
        event.nftName,
        event.nftSymbol
      );

      console.log(`⏳ Transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error("Transaction receipt is null");
      }

      // Find the EventCreated event in the logs
      const eventCreatedLog = receipt.logs.find((log: any) => {
        try {
          const parsedLog = factory.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          return parsedLog?.name === 'EventCreated';
        } catch {
          return false;
        }
      });

      if (eventCreatedLog) {
        const parsedLog = factory.interface.parseLog({
          topics: eventCreatedLog.topics,
          data: eventCreatedLog.data
        });
        
        if (parsedLog) {
          const eventId = parsedLog.args[0];
          const eventContract = parsedLog.args[2];
          const nftContract = parsedLog.args[3];
          
          createdEvents.push({
            id: eventId,
            title: event.title,
            eventContract,
            nftContract
          });

          console.log(`✅ Event Created Successfully:`);
          console.log(`   - Event ID: ${eventId}`);
          console.log(`   - Event Contract: ${eventContract}`);
          console.log(`   - NFT Contract: ${nftContract}`);
        }
      }

      console.log(`💰 Gas used: ${receipt.gasUsed.toString()}\n`);
      
    } catch (error) {
      console.error(`❌ Failed to create event ${i + 1}:`, error);
      console.log("Continuing with next event...\n");
    }
  }

  console.log("🎉 Event creation process completed!");
  console.log(`✅ Successfully created ${createdEvents.length} out of ${events.length} events`);

  if (createdEvents.length > 0) {
    console.log("\n📋 Created Events Summary:");
    createdEvents.forEach((event, index) => {
      console.log(`${index + 1}. ${event.title} (ID: ${event.id})`);
      console.log(`   Event Contract: ${event.eventContract}`);
      console.log(`   NFT Contract: ${event.nftContract}`);
    });

    // Get updated factory stats
    console.log("\n📊 Factory Statistics:");
    const allEventIds = await factory.getAllEventIds();
    const activeEvents = await factory.getActiveEvents();
    console.log(`- Total Events: ${allEventIds.length}`);
    console.log(`- Active Events: ${activeEvents.length}`);
    console.log(`- Event IDs: [${allEventIds.join(', ')}]`);
  }

  console.log("\n💡 Next Steps:");
  console.log("1. Update your frontend to use the factory address and event IDs");
  console.log("2. Users can now purchase tickets through the event contracts");
  console.log("3. NFTs will be minted automatically upon ticket purchase");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  }); 