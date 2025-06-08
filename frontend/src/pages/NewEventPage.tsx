import * as React from 'react';
import { useState } from 'react';
import { useWriteContract } from 'wagmi';
import { parseEther } from 'ethers';
import {
  CONTRACT_CONFIG,
  validateEventForm,
  type CreateEventParams,
} from '../utils/contractHelpers';

const NewEventPage = () => {
  const { writeContractAsync, isPending } = useWriteContract();

  const [formData, setFormData] = useState<CreateEventParams>({
    title: '',
    description: '',
    ticketPrice: '',
    maxTickets: '',
    eventURI: '',
    eventStartTime: '',
    eventEndTime: '',
    venue: '',
    nftName: '',
    nftSymbol: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;

    // Auto-uppercase the NFT symbol
    const processedValue = name === 'nftSymbol' ? value.toUpperCase() : value;

    setFormData({ ...formData, [name]: processedValue });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isPending) return;

    // Validate form data
    const validation = validateEventForm(formData);
    if (!validation.isValid) {
      alert(validation.error);
      return;
    }

    const {
      title,
      description,
      ticketPrice,
      maxTickets,
      eventURI,
      eventStartTime,
      eventEndTime,
      venue,
      nftName,
      nftSymbol,
    } = formData;

    try {
      // Convert dates to Unix timestamps
      const startTimestamp = Math.floor(
        new Date(eventStartTime).getTime() / 1000,
      );
      const endTimestamp = Math.floor(new Date(eventEndTime).getTime() / 1000);

      const tx = await writeContractAsync({
        address: CONTRACT_CONFIG.address,
        abi: CONTRACT_CONFIG.abi,
        functionName: 'createEvent',
        args: [
          title,
          description,
          parseEther(ticketPrice),
          BigInt(maxTickets),
          eventURI,
          BigInt(startTimestamp),
          BigInt(endTimestamp),
          venue,
          nftName,
          nftSymbol,
        ],
      });

      console.log('Transaction successful:', tx);

      // Reset form after successful submission
      setFormData({
        title: '',
        description: '',
        ticketPrice: '',
        maxTickets: '',
        eventURI: '',
        eventStartTime: '',
        eventEndTime: '',
        venue: '',
        nftName: '',
        nftSymbol: '',
      });

      alert('Event created successfully!');
    } catch (err) {
      console.error('Contract call failed:', err);
      alert('Failed to create event. Please try again.');
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
          placeholder="e.g., Summer Music Festival 2024"
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
          placeholder="Describe your event in detail..."
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
          placeholder="0.1"
          step="0.001"
          min="0"
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
          placeholder="1000"
          min="1"
          required
        />
      </div>

      <div>
        <label className="block text-red-700 font-semibold mb-1">
          Event Start Time
        </label>
        <input
          type="datetime-local"
          name="eventStartTime"
          value={formData.eventStartTime}
          onChange={handleChange}
          className="w-full border border-red-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          required
        />
      </div>

      <div>
        <label className="block text-red-700 font-semibold mb-1">
          Event End Time
        </label>
        <input
          type="datetime-local"
          name="eventEndTime"
          value={formData.eventEndTime}
          onChange={handleChange}
          className="w-full border border-red-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          required
        />
      </div>

      <div>
        <label className="block text-red-700 font-semibold mb-1">Venue</label>
        <input
          type="text"
          name="venue"
          value={formData.venue}
          onChange={handleChange}
          className="w-full border border-red-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          placeholder="e.g., Madison Square Garden, New York"
          required
        />
      </div>

      <div>
        <label className="block text-red-700 font-semibold mb-1">
          NFT Collection Name
        </label>
        <input
          type="text"
          name="nftName"
          value={formData.nftName}
          onChange={handleChange}
          className="w-full border border-red-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          placeholder="e.g., Summer Music Festival 2024 Tickets"
          required
        />
      </div>

      <div>
        <label className="block text-red-700 font-semibold mb-1">
          NFT Symbol
        </label>
        <input
          type="text"
          name="nftSymbol"
          value={formData.nftSymbol}
          onChange={handleChange}
          className="w-full border border-red-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          placeholder="e.g., MUSIC, FEST, EVENT"
          maxLength={10}
          style={{ textTransform: 'uppercase' }}
          required
        />
        <p className="text-sm text-gray-600 mt-1">
          2-10 uppercase letters (will be converted automatically)
        </p>
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
          placeholder="e.g., https://example.com/event-metadata.json"
          required
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-red-600 text-white p-3 rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Creating Event...' : 'Create Event'}
      </button>
    </form>
  );
};

export default NewEventPage;
