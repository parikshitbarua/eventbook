import * as React from 'react';
import { useState } from 'react';
import { useWriteContract } from 'wagmi';
import { ethers } from 'ethers';
import EventTicketNFTABI from '../abis/EventTicketNFTABI.json';

const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

const NewEventPage = () => {
  const { writeContractAsync, isPending } = useWriteContract();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    ticketPrice: '',
    maxTickets: '',
    eventURI: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(isPending);

    const { title, description, ticketPrice, maxTickets, eventURI } = formData;

    try {
      const tx = await writeContractAsync({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: EventTicketNFTABI,
        functionName: 'createEvent',
        args: [
          title,
          description,
          BigInt(ethers.parseEther(ticketPrice)),
          BigInt(maxTickets),
          eventURI,
        ],
      });

      console.log('Transaction successful:', tx);
      // Optionally: wait for confirmation
      // const receipt = await tx.wait();
    } catch (err) {
      console.error('Contract call failed:', err);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-10 max-w-xl mx-auto bg-white p-8 shadow-xl rounded-2xl space-y-6 border border-red-200"
    >
      <h2 className="text-2xl font-bold text-red-600 text-center">
        Create Event
      </h2>

      <div>
        <label className="block text-red-700 font-semibold mb-1">Title</label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={handleChange}
          className="w-full border border-red-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          required
        />
      </div>

      <div>
        <label className="block text-red-700 font-semibold mb-1">
          Description
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          className="w-full border border-red-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          rows={4}
          required
        />
      </div>

      <div>
        <label className="block text-red-700 font-semibold mb-1">
          Ticket Price (in ETH)
        </label>
        <input
          type="number"
          name="ticketPrice"
          value={formData.ticketPrice}
          onChange={handleChange}
          className="w-full border border-red-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          required
        />
      </div>

      <div>
        <label className="block text-red-700 font-semibold mb-1">
          Max Tickets
        </label>
        <input
          type="number"
          name="maxTickets"
          value={formData.maxTickets}
          onChange={handleChange}
          className="w-full border border-red-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          required
        />
      </div>

      <div>
        <label className="block text-red-700 font-semibold mb-1">
          Event URI
        </label>
        <input
          type="text"
          name="eventURI"
          value={formData.eventURI}
          onChange={handleChange}
          className="w-full border border-red-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          required
        />
      </div>

      <button
        type="submit"
        className="w-full bg-red-600 text-white p-3 rounded-lg font-semibold hover:bg-red-700 transition"
      >
        Submit Event
      </button>
    </form>
  );
};

export default NewEventPage;
