import * as React from 'react';
import { useEffect, useState } from 'react';
import { JsonRpcProvider, Contract } from 'ethers';
import type { EventTicketNFT } from '../../typechain-types';
import type { EventData } from '../../utils/models';
import EventTicketNFTABI from '../abis/EventTicketNFTABI.json';

const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

// const events = [
//     {
//         id: 1,
//         title: 'Music Fest 2025',
//         description: 'A grand night of live music and fun!',
//         image: '/images/musicfest.jpg',
//         price: 499,
//     },
//     {
//         id: 2,
//         title: 'Tech Expo',
//         description: 'Explore the future of technology.',
//         image: '/images/techexpo.jpg',
//         price: 299,
//     },
//     // Add more events...
// ];

const HomePage = () => {
  const [allEvents, setAllEvents] = useState<EventData[]>([]);

  useEffect(() => {
    async function fetchData() {
      const provider = new JsonRpcProvider('http://127.0.0.1:8545');
      const contract = new Contract(
        CONTRACT_ADDRESS,
        EventTicketNFTABI,
        provider,
      ) as unknown as EventTicketNFT;

      try {
        const eventData: EventData[] = [];
        const eventIds = await contract.getAllEventIds();
        await Promise.all(
          eventIds.map(async (eventId) => {
            const event = await contract.events(eventId);
            eventData.push({
              id: Number(event.eventId),
              title: event.title,
              description: event.description,
              eventURI: event.eventURI,
              ticketPrice: event.ticketPrice,
            });
          }),
        );
        setAllEvents(eventData);
        console.log(allEvents);
      } catch (err) {
        console.error('Contract call failed', err);
      }
    }

    fetchData();
  }, [allEvents]);

  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <h1 className="text-4xl font-bold text-red-600 text-center mb-10">
        Upcoming Events
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
        {allEvents.map((event) => (
          <div
            key={event.id}
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
                  {Number(event.ticketPrice) / 1e18} ETH
                </span>
                <button className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition">
                  Buy Ticket
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HomePage;
