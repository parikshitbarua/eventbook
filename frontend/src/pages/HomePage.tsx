import * as React from 'react';
import { useEffect, useState } from 'react';
import { JsonRpcProvider, Contract } from 'ethers';
import type { EventData } from '../utils/models';
import type { EventFactoryContract } from '../types/contracts';
import TicketPurchaseModal from '../components/TicketPurchaseModal';
import EventFactoryABI from '../contracts/EventFactory.sol/EventFactory.json';

const FACTORY_ADDRESS =
  import.meta.env.FACTORY_ADDRESS ||
  '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
const NETWORK_URL = import.meta.env.NETWORK_URL || 'http://127.0.0.1:8545';

const HomePage = () => {
  const [allEvents, setAllEvents] = useState<EventData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const provider = new JsonRpcProvider(NETWORK_URL);
        const contract = new Contract(
          FACTORY_ADDRESS,
          EventFactoryABI.abi,
          provider,
        ) as unknown as EventFactoryContract;

        const eventData: EventData[] = [];
        // Get only active event IDs
        const activeEventIds = await contract.getActiveEvents();
        console.log('Active event IDs:', activeEventIds);

        await Promise.all(
          activeEventIds.map(async (eventId: bigint) => {
            try {
              // Use getEventDetails instead of events mapping
              const eventDetails = await contract.getEventDetails(eventId);

              eventData.push({
                eventId: Number(eventId),
                title: eventDetails.eventInfo.title,
                description: eventDetails.description,
                organizer: eventDetails.eventInfo.organizer as `0x${string}`,
                ticketPrice: eventDetails.ticketPrice,
                maxTickets: eventDetails.maxTickets,
                ticketsSold: eventDetails.eventInfo.ticketsSold,
                ticketsLeft: BigInt(
                  Number(eventDetails.maxTickets) -
                    Number(eventDetails.eventInfo.ticketsSold),
                ),
                isActive: eventDetails.eventInfo.isActive,
                eventURI: eventDetails.eventURI,
                createdAt: eventDetails.eventInfo.createdAt,
                // Additional fields from EventFactory
                eventStartTime: eventDetails.eventStartTime,
                eventEndTime: eventDetails.eventEndTime,
                venue: eventDetails.venue,
                eventContract: eventDetails.eventInfo
                  .eventContract as `0x${string}`,
                nftContract: eventDetails.eventInfo
                  .nftContract as `0x${string}`,
                totalRevenue: eventDetails.eventInfo.totalRevenue,
              });
            } catch (err) {
              console.error(`Failed to fetch event ${eventId}:`, err);
            }
          }),
        );

        setAllEvents(eventData);
      } catch (err) {
        console.error('Contract call failed', err);
      }
    }

    fetchData();
  }, []);

  const handlePurchase = async (quantity: number) => {
    if (!selectedEvent) return;

    try {
      console.log('Purchasing tickets for event:', quantity);
      // const provider = new JsonRpcProvider('http://127.0.0.1:8545');
      //
      // // TODO: Implement the actual purchase logic here
      // console.log(`Purchasing ${quantity} tickets for event ${selectedEvent.eventId}`);
    } catch (error) {
      console.error('Purchase failed:', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <h1 className="text-4xl font-bold text-red-600 text-center mb-10">
        Upcoming Events
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
        {allEvents.map((event) => (
          <div
            key={event.eventId}
            className="bg-white shadow-lg rounded-2xl overflow-hidden border border-gray-200"
          >
            <img
              src="https://djmag.com/sites/default/files/styles/djm_23_961x540_jpg/public/2024-07/Tomorrowland.jpg?itok=IhV-aC4t"
              alt={event.title}
              className="h-48 w-full object-cover"
            />
            <div className="p-4 flex flex-col justify-between h-48">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">
                  {event.title}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {event.description}
                </p>
              </div>
              <div className="mt-4 flex justify-between items-center">
                <span className="text-lg font-bold text-red-600">
                  {event.ticketPrice ? Number(event.ticketPrice) / 1e18 : 0} ETH
                </span>
                <button
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
                  onClick={() => {
                    setSelectedEvent(event);
                    setIsModalOpen(true);
                  }}
                >
                  Buy Ticket
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedEvent && (
        <TicketPurchaseModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedEvent(null);
          }}
          event={selectedEvent}
          onPurchase={handlePurchase}
        />
      )}
    </div>
  );
};

export default HomePage;
