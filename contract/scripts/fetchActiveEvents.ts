import { ethers } from "hardhat";

interface EventDetails {
  eventId: number;
  eventInfo: {
    eventContract: string;
    nftContract: string;
    organizer: string;
    title: string;
    createdAt: bigint;
    isActive: boolean;
    ticketsSold: bigint;
    totalRevenue: bigint;
  };
  description: string;
  ticketPrice: bigint;
  maxTickets: bigint;
  eventURI: string;
  eventStartTime: bigint;
  eventEndTime: bigint;
  venue: string;
}

async function main() {
  console.log("🔍 Fetching all active events...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("🔑 Account:", deployer.address);
  console.log("💰 Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Replace with your deployed EventFactory address
  const FACTORY_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  // Get the factory contract (no library linking needed with Clones pattern)
  const EventFactory = await ethers.getContractFactory("EventFactory");
  const factory = EventFactory.attach(FACTORY_ADDRESS) as any;

  try {
    // Get basic factory stats
    console.log("\n📊 Factory Statistics:");
    const totalEvents = await factory.eventCounter();
    const allEventIds = await factory.getAllEventIds();
    const activeEventIds = await factory.getActiveEvents();
    
    console.log(`- Total Events Created: ${totalEvents}`);
    console.log(`- All Event IDs: [${allEventIds.join(', ')}]`);
    console.log(`- Active Events Count: ${activeEventIds.length}`);
    console.log(`- Platform Fee: ${await factory.platformFee()} basis points (${(Number(await factory.platformFee()) / 100).toString()}%)`);
    console.log(`- Platform Fee Recipient: ${await factory.platformFeeRecipient()}`);

    if (activeEventIds.length === 0) {
      console.log("\n📭 No active events found.");
      return;
    }

    console.log(`\n🎪 Fetching details for ${activeEventIds.length} active events...\n`);

    const activeEvents: EventDetails[] = [];

    // Fetch detailed information for each active event
    for (let i = 0; i < activeEventIds.length; i++) {
      const eventId = activeEventIds[i];
      
      try {
        console.log(`📅 Fetching Event ${i + 1}/${activeEventIds.length} (ID: ${eventId})...`);
        
        // Get comprehensive event details from the factory
        const eventDetails = await factory.getEventDetails(eventId);
        
        const eventData: EventDetails = {
          eventId: Number(eventId),
          eventInfo: {
            eventContract: eventDetails.eventInfo.eventContract,
            nftContract: eventDetails.eventInfo.nftContract,
            organizer: eventDetails.eventInfo.organizer,
            title: eventDetails.eventInfo.title,
            createdAt: eventDetails.eventInfo.createdAt,
            isActive: eventDetails.eventInfo.isActive,
            ticketsSold: eventDetails.eventInfo.ticketsSold,
            totalRevenue: eventDetails.eventInfo.totalRevenue
          },
          description: eventDetails.description,
          ticketPrice: eventDetails.ticketPrice,
          maxTickets: eventDetails.maxTickets,
          eventURI: eventDetails.eventURI,
          eventStartTime: eventDetails.eventStartTime,
          eventEndTime: eventDetails.eventEndTime,
          venue: eventDetails.venue
        };

        activeEvents.push(eventData);
        console.log(`✅ Event "${eventData.eventInfo.title}" fetched successfully`);
        
      } catch (error) {
        console.error(`❌ Failed to fetch event ${eventId}:`, error);
      }
    }

    // Display detailed information for all active events
    if (activeEvents.length > 0) {
      console.log(`\n🎉 Successfully fetched ${activeEvents.length} active events!\n`);
      console.log("=" .repeat(80));
      
      activeEvents.forEach((event, index) => {
        const startDate = new Date(Number(event.eventStartTime) * 1000);
        const endDate = new Date(Number(event.eventEndTime) * 1000);
        const createdDate = new Date(Number(event.eventInfo.createdAt) * 1000);
        
        console.log(`\n🎪 Event ${index + 1}: ${event.eventInfo.title}`);
        console.log("-".repeat(60));
        console.log(`📍 Event ID: ${event.eventId}`);
        console.log(`📝 Description: ${event.description}`);
        console.log(`📍 Venue: ${event.venue}`);
        console.log(`👤 Organizer: ${event.eventInfo.organizer}`);
        console.log(`💰 Ticket Price: ${ethers.formatEther(event.ticketPrice)} ETH`);
        console.log(`🎫 Max Tickets: ${event.maxTickets === 0n ? 'Unlimited' : event.maxTickets.toString()}`);
        console.log(`🎫 Tickets Sold: ${event.eventInfo.ticketsSold}`);
        console.log(`💵 Total Revenue: ${ethers.formatEther(event.eventInfo.totalRevenue)} ETH`);
        console.log(`📅 Event Start: ${startDate.toLocaleString()}`);
        console.log(`📅 Event End: ${endDate.toLocaleString()}`);
        console.log(`📅 Created At: ${createdDate.toLocaleString()}`);
        console.log(`🔗 Event URI: ${event.eventURI}`);
        console.log(`📄 Event Contract: ${event.eventInfo.eventContract}`);
        console.log(`🎨 NFT Contract: ${event.eventInfo.nftContract}`);
        console.log(`✅ Status: ${event.eventInfo.isActive ? 'Active' : 'Inactive'}`);
        
        // Calculate event status based on current time
        const now = Math.floor(Date.now() / 1000);
        let eventStatus = "";
        if (now < Number(event.eventStartTime)) {
          eventStatus = "🔜 Upcoming";
        } else if (now >= Number(event.eventStartTime) && now <= Number(event.eventEndTime)) {
          eventStatus = "🔴 Live Now";
        } else {
          eventStatus = "✅ Completed";
        }
        console.log(`📊 Event Status: ${eventStatus}`);
        
        if (index < activeEvents.length - 1) {
          console.log("\n" + "=".repeat(80));
        }
      });

      // Summary statistics
      console.log(`\n📈 Summary Statistics:`);
      console.log("-".repeat(40));
      const totalTicketsSold = activeEvents.reduce((sum, event) => sum + Number(event.eventInfo.ticketsSold), 0);
      const totalRevenue = activeEvents.reduce((sum, event) => sum + Number(event.eventInfo.totalRevenue), 0);
      const avgTicketPrice = activeEvents.reduce((sum, event) => sum + Number(event.ticketPrice), 0) / activeEvents.length;
      
      console.log(`🎫 Total Tickets Sold: ${totalTicketsSold}`);
      console.log(`💰 Total Revenue: ${ethers.formatEther(totalRevenue.toString())} ETH`);
      console.log(`📊 Average Ticket Price: ${ethers.formatEther(avgTicketPrice.toString())} ETH`);
      console.log(`🎪 Active Events: ${activeEvents.length}`);

      // Export data as JSON for external use
      const exportData = {
        fetchedAt: new Date().toISOString(),
        factoryAddress: FACTORY_ADDRESS,
        totalEventsCreated: Number(totalEvents),
        activeEventsCount: activeEvents.length,
        activeEvents: activeEvents.map(event => ({
          ...event,
          eventInfo: {
            ...event.eventInfo,
            createdAt: Number(event.eventInfo.createdAt),
            ticketsSold: Number(event.eventInfo.ticketsSold),
            totalRevenue: Number(event.eventInfo.totalRevenue)
          },
          ticketPrice: Number(event.ticketPrice),
          maxTickets: Number(event.maxTickets),
          eventStartTime: Number(event.eventStartTime),
          eventEndTime: Number(event.eventEndTime)
        }))
      };

      console.log(`\n💾 Event data exported successfully!`);
      console.log(`📄 You can access the structured data in your application using the returned event details.`);
      
    } else {
      console.log("\n📭 No active events were successfully fetched.");
    }

  } catch (error) {
    console.error("❌ Failed to fetch active events:", error);
  }

  console.log("\n🏁 Fetch complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  }); 