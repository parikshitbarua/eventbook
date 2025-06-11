import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useWriteContract, useAccount } from 'wagmi';
import { parseEther } from 'ethers';
import Confetti from 'react-confetti';
import type { AddTicketsNavigationState } from '../types/navigation';
import {
  uploadImageToIPFSHelperUtil,
  createTicketURIHelperUtil,
} from '../utils/ipfs-helper.util.ts';
import EventContractABI from '../contracts/EventContract.sol/EventContract.json';

interface TicketCategory {
  id: string;
  name: string;
  description: string;
  price: string;
  maxSupply: string;
  image?: File;
}

type TicketType = 'single' | 'multi';

const AddTicketsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { writeContractAsync } = useWriteContract();
  const { address, isConnected } = useAccount();

  // Get the navigation state with contract addresses and event details
  const navigationState = location.state as AddTicketsNavigationState | null;

  // State management
  const [ticketType, setTicketType] = useState<TicketType>('single');
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TicketCategory | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [buttonText, setButtonText] = useState('Add Ticket Categories');

  // Success state management
  const [showConfetti, setShowConfetti] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Update window dimensions for confetti
  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Category management functions
  const addCategory = () => {
    if (categories.length >= 5) {
      alert('Maximum 5 categories allowed');
      return;
    }
    setEditingCategory({
      id: '',
      name: '',
      description: '',
      price: '',
      maxSupply: '',
      image: undefined,
    });
    setShowCategoryForm(true);
  };

  const editCategory = (category: TicketCategory) => {
    setEditingCategory(category);
    setShowCategoryForm(true);
  };

  const saveCategory = (category: TicketCategory) => {
    if (category.id) {
      // Update existing category
      setCategories((prev) =>
        prev.map((cat) => (cat.id === category.id ? category : cat)),
      );
    } else {
      // Add new category
      const newCategory = { ...category, id: Date.now().toString() };
      setCategories((prev) => [...prev, newCategory]);
    }
    setShowCategoryForm(false);
    setEditingCategory(null);
  };

  const removeCategory = (id: string) => {
    setCategories((prev) => prev.filter((cat) => cat.id !== id));
  };

  const handleTicketCategoriesAdded = async () => {
    try {
      setIsSubmitting(true);

      // Check wallet connection
      if (!isConnected || !address) {
        alert('Please connect your wallet to add ticket categories');
        setIsSubmitting(false);
        return;
      }

      // Check if we have an event contract address
      if (!navigationState?.eventContract) {
        alert('Event contract address not found');
        setIsSubmitting(false);
        return;
      }

      if (ticketType === 'multi') {
        if (categories.length === 0) {
          alert('Please add at least one ticket category');
          setIsSubmitting(false);
          return;
        }

        // Process all categories using Promise.all to handle async operations properly
        const processedCategories = await Promise.all(
          categories.map(async (category) => {
            let imageURI;
            if (category.image) {
              setButtonText('Uploading Ticket Images');
              const imageCID = await uploadImageToIPFSHelperUtil(
                category.image,
              );
              imageURI = `https://${imageCID}.ipfs.w3s.link`;
            } else {
              imageURI =
                'https://static.vecteezy.com/system/resources/previews/002/779/812/non_2x/cartoon-illustration-of-ticket-free-vector.jpg';
            }

            const ticketMetadata = {
              name: category.name,
              description: category.description,
              image: imageURI,
              price: category.price,
              maxSupply: category.maxSupply,
              admits: 1,
            };

            setButtonText('Generating Ticket Metadata');
            const ticketURI = await createTicketURIHelperUtil(ticketMetadata);
            if (!ticketURI) {
              throw new Error(
                `Failed to create ticket URI for category: ${category.name}`,
              );
            }

            return {
              name: category.name,
              price: parseEther(category.price), // Convert ETH string to Wei
              maxSupply: BigInt(category.maxSupply),
              categoryURI: ticketURI,
            };
          }),
        );

        setButtonText('Storing Ticket Details');

        // Call the smart contract
        try {
          const result = await writeContractAsync({
            address: navigationState.eventContract as `0x${string}`,
            abi: EventContractABI.abi,
            functionName: 'addTicketCategories',
            args: [processedCategories],
          });

          console.log('Transaction hash:', result);
          setButtonText('Transaction Submitted');

          // Show confetti and success dialog
          setShowConfetti(true);
          setShowSuccessDialog(true);

          // Stop confetti after 5 seconds
          setTimeout(() => {
            setShowConfetti(false);
          }, 5000);
        } catch (contractError) {
          console.error('Contract call failed:', contractError);
          const errorMessage =
            contractError instanceof Error
              ? contractError.message
              : 'Unknown contract error';
          alert(`Failed to add ticket categories: ${errorMessage}`);
        }
      } else {
        // For single ticket type, show success immediately
        setShowConfetti(true);
        setShowSuccessDialog(true);
        setTimeout(() => {
          setShowConfetti(false);
        }, 5000);
      }
    } catch (error) {
      console.error('Error processing categories:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Error processing categories: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
      setButtonText('Add Ticket Categories');
    }
  };

  // Category Form Component
  const CategoryForm = ({
    category,
    onSave,
    onCancel,
  }: {
    category: TicketCategory;
    onSave: (category: TicketCategory) => void;
    onCancel: () => void;
  }) => {
    const [formData, setFormData] = useState<TicketCategory>(category);

    const onDrop = useCallback((acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setFormData((prev) => ({ ...prev, image: acceptedFiles[0] }));
      }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop,
      accept: {
        'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      },
      multiple: false,
      maxSize: 5 * 1024 * 1024, // 5MB
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name || !formData.price || !formData.maxSupply) {
        alert('Please fill in all required fields');
        return;
      }
      onSave(formData);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">
                {category.id ? 'Edit' : 'Add'} Ticket Category
              </h3>
            </div>

            {/* Form Content */}
            <div className="px-6 py-6 space-y-6">
              {/* Category Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="e.g., VIP, General Admission, Early Bird"
                  required
                />
              </div>
              Description
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Describe what this ticket category includes..."
                  required
                />
              </div>
              {/* Price and Supply */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price (ETH) *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        price: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="0.1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Supply *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxSupply}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        maxSupply: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="100"
                    required
                  />
                </div>
              </div>
              {/* Optional Seat Number */}
              {/*<div>*/}
              {/*  <label className="block text-sm font-medium text-gray-700 mb-2">*/}
              {/*    Seat Number (Optional)*/}
              {/*  </label>*/}
              {/*  <input*/}
              {/*    type="text"*/}
              {/*    value={formData.seatNumber || ''}*/}
              {/*    onChange={(e) => setFormData(prev => ({ ...prev, seatNumber: e.target.value }))}*/}
              {/*    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"*/}
              {/*    placeholder="e.g., A1-A50, General Admission"*/}
              {/*  />*/}
              {/*</div>*/}
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ticket Design Image
                </label>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    isDragActive
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-300 hover:border-red-400 hover:bg-gray-50'
                  }`}
                >
                  <input {...getInputProps()} />
                  {formData.image ? (
                    <div className="space-y-2">
                      <img
                        src={URL.createObjectURL(formData.image)}
                        alt="Ticket design"
                        className="mx-auto h-24 w-24 object-cover rounded-lg"
                      />
                      <p className="text-sm text-gray-600">
                        {formData.image.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Click or drag to replace
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="mx-auto w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                          />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-600">
                        {isDragActive
                          ? 'Drop image here'
                          : 'Drag & drop or click to upload'}
                      </p>
                      <p className="text-xs text-gray-500">
                        PNG, JPG, GIF up to 5MB
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                {category.id ? 'Update' : 'Add'} Category
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Success Dialog Component
  const SuccessDialog = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center">
        {/* Success Icon */}
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        {/* Success Message */}
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          Event Has Been Successfully Created! 🎉
        </h3>
        <p className="text-gray-600 mb-8">
          Your event tickets have been added to the blockchain and are ready for
          sale.
        </p>

        {/* Action Button */}
        <button
          onClick={() => {
            setShowSuccessDialog(false);
            navigate('/');
          }}
          className="w-full px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium"
        >
          Continue to Home
        </button>
      </div>
    </div>
  );

  // If no state was passed, redirect back to create event
  useEffect(() => {
    if (!navigationState) {
      console.warn('No event data found. Redirecting to create event page.');
      navigate('/new-event');
    }
  }, [navigationState, navigate]);

  if (!navigationState) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading...</h2>
          <p className="text-gray-600">Redirecting to create event page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Add Tickets</h1>
          <p className="text-gray-600">
            Configure ticket details for your event:{' '}
            <span className="font-semibold">{navigationState?.eventTitle}</span>
          </p>
        </div>

        {/* Ticket Type Selection */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Ticket Type
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setTicketType('single')}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                ticketType === 'single'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center mb-3">
                <div
                  className={`w-4 h-4 rounded-full border-2 mr-3 ${
                    ticketType === 'single'
                      ? 'border-red-500 bg-red-500'
                      : 'border-gray-300'
                  }`}
                >
                  {ticketType === 'single' && (
                    <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900">Single Type</h3>
              </div>
              <p className="text-gray-600 text-sm">
                All tickets are the same with equal pricing and access
              </p>
            </button>

            <button
              onClick={() => setTicketType('multi')}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                ticketType === 'multi'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center mb-3">
                <div
                  className={`w-4 h-4 rounded-full border-2 mr-3 ${
                    ticketType === 'multi'
                      ? 'border-red-500 bg-red-500'
                      : 'border-gray-300'
                  }`}
                >
                  {ticketType === 'multi' && (
                    <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900">
                  Multiple Categories
                </h3>
              </div>
              <p className="text-gray-600 text-sm">
                Different ticket types with varying prices and access levels
              </p>
            </button>
          </div>
        </div>

        {/* Single Ticket Configuration */}
        {/*{ticketType === 'single' && (*/}
        {/*  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-6">*/}
        {/*    <h2 className="text-xl font-semibold text-gray-900 mb-6">Single Ticket Configuration</h2>*/}
        {/*    <div className="space-y-6">*/}
        {/*      /!* Ticket Name *!/*/}
        {/*      <div>*/}
        {/*        <label className="block text-sm font-medium text-gray-700 mb-2">*/}
        {/*          Ticket Name **/}
        {/*        </label>*/}
        {/*        <input*/}
        {/*          type="text"*/}
        {/*          value={singleTicket.name}*/}
        {/*          onChange={(e) => setSingleTicket(prev => ({ ...prev, name: e.target.value }))}*/}
        {/*          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"*/}
        {/*          placeholder="e.g., General Admission"*/}
        {/*          required*/}
        {/*        />*/}
        {/*      </div>*/}

        {/*      /!* Description *!/*/}
        {/*      <div>*/}
        {/*        <label className="block text-sm font-medium text-gray-700 mb-2">*/}
        {/*          Description **/}
        {/*        </label>*/}
        {/*        <textarea*/}
        {/*          value={singleTicket.description}*/}
        {/*          onChange={(e) => setSingleTicket(prev => ({ ...prev, description: e.target.value }))}*/}
        {/*          rows={3}*/}
        {/*          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"*/}
        {/*          placeholder="Describe what this ticket includes..."*/}
        {/*          required*/}
        {/*        />*/}
        {/*      </div>*/}

        {/*      /!* Price and Supply *!/*/}
        {/*      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">*/}
        {/*        <div>*/}
        {/*          <label className="block text-sm font-medium text-gray-700 mb-2">*/}
        {/*            Price (ETH) **/}
        {/*          </label>*/}
        {/*          <input*/}
        {/*            type="number"*/}
        {/*            step="0.001"*/}
        {/*            min="0"*/}
        {/*            value={singleTicket.price}*/}
        {/*            onChange={(e) => setSingleTicket(prev => ({ ...prev, price: e.target.value }))}*/}
        {/*            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"*/}
        {/*            placeholder="0.1"*/}
        {/*            required*/}
        {/*          />*/}
        {/*        </div>*/}
        {/*        <div>*/}
        {/*          <label className="block text-sm font-medium text-gray-700 mb-2">*/}
        {/*            Max Supply **/}
        {/*          </label>*/}
        {/*          <input*/}
        {/*            type="number"*/}
        {/*            min="1"*/}
        {/*            value={singleTicket.maxSupply}*/}
        {/*            onChange={(e) => setSingleTicket(prev => ({ ...prev, maxSupply: e.target.value }))}*/}
        {/*            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"*/}
        {/*            placeholder="100"*/}
        {/*            required*/}
        {/*          />*/}
        {/*        </div>*/}
        {/*      </div>*/}

        {/*      /!* Optional Seat Number *!/*/}
        {/*      <div>*/}
        {/*        <label className="block text-sm font-medium text-gray-700 mb-2">*/}
        {/*          Seat Information (Optional)*/}
        {/*        </label>*/}
        {/*        <input*/}
        {/*          type="text"*/}
        {/*          value={singleTicket.seatNumber}*/}
        {/*          onChange={(e) => setSingleTicket(prev => ({ ...prev, seatNumber: e.target.value }))}*/}
        {/*          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"*/}
        {/*          placeholder="e.g., A1-A50, General Admission"*/}
        {/*        />*/}
        {/*      </div>*/}
        {/*    </div>*/}
        {/*  </div>*/}
        {/*)}*/}

        {/* Multi Category Configuration */}
        {ticketType === 'multi' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Ticket Categories
              </h2>
              <button
                onClick={addCategory}
                disabled={categories.length >= 5}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  categories.length >= 5
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                Add Category{' '}
                {categories.length > 0 && `(${categories.length}/5)`}
              </button>
            </div>

            {categories.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No ticket categories yet
                </h3>
                <p className="text-gray-500 mb-4">
                  Add your first ticket category to get started
                </p>
                {/*<button*/}
                {/*  onClick={addCategory}*/}
                {/*  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"*/}
                {/*>*/}
                {/*  Add First Category*/}
                {/*</button>*/}
              </div>
            ) : (
              <div className="space-y-4">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="border border-gray-200 rounded-xl p-6"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {category.name}
                        </h3>
                        <p className="text-gray-600 text-sm mb-2">
                          {category.description}
                        </p>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <span className="text-green-600 font-medium">
                            {category.price} ETH
                          </span>
                          <span className="text-blue-600">
                            Max: {category.maxSupply} tickets
                          </span>
                          {/*{category.seatNumber && (*/}
                          {/*  <span className="text-purple-600">*/}
                          {/*    Seats: {category.seatNumber}*/}
                          {/*  </span>*/}
                          {/*)}*/}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        {category.image && (
                          <img
                            src={URL.createObjectURL(category.image)}
                            alt="Ticket design"
                            className="w-12 h-12 object-cover rounded-lg"
                          />
                        )}
                        <button
                          onClick={() => editCategory(category)}
                          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => removeCategory(category.id)}
                          className="p-2 text-red-400 hover:text-red-600 transition-colors"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Event Details Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
          <h3 className="font-medium text-blue-900 mb-3">Event Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <p>
                <span className="font-medium">Event:</span>{' '}
                {navigationState?.eventTitle}
              </p>
              <p>
                <span className="font-medium">Description:</span>{' '}
                {navigationState?.eventDescription}
              </p>
              {navigationState?.eventId && (
                <p>
                  <span className="font-medium">Event ID:</span>{' '}
                  {navigationState.eventId}
                </p>
              )}
            </div>
            <div>
              {navigationState?.organizer && (
                <p>
                  <span className="font-medium">Organizer:</span>{' '}
                  {navigationState.organizer.slice(0, 8)}...
                </p>
              )}
              {navigationState?.eventContract && (
                <p>
                  <span className="font-medium">Event Contract:</span>{' '}
                  {navigationState.eventContract.slice(0, 8)}...
                </p>
              )}
              {navigationState?.nftContract && (
                <p>
                  <span className="font-medium">NFT Contract:</span>{' '}
                  {navigationState.nftContract.slice(0, 8)}...
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-medium"
          >
            Back
          </button>
          <button
            disabled={isSubmitting}
            onClick={handleTicketCategoriesAdded}
            className={`px-8 py-3 rounded-xl transition-colors font-medium ${
              isSubmitting
                ? 'bg-red-400 text-gray-200 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {buttonText}
              </div>
            ) : (
              'Add Ticket Categories'
            )}
          </button>
        </div>
      </div>

      {/* Category Form Modal */}
      {showCategoryForm && editingCategory && (
        <CategoryForm
          category={editingCategory}
          onSave={saveCategory}
          onCancel={() => {
            setShowCategoryForm(false);
            setEditingCategory(null);
          }}
        />
      )}

      {/* Confetti */}
      {showConfetti && (
        <Confetti
          width={windowDimensions.width}
          height={windowDimensions.height}
        />
      )}

      {/* Success Dialog */}
      {showSuccessDialog && <SuccessDialog />}
    </div>
  );
};

export default AddTicketsPage;
