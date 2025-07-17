import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useWriteContract, useAccount } from 'wagmi';
import { parseEther } from 'ethers';

import type { AddTicketsNavigationState } from '../types/navigation.types.ts';
import {
  uploadImageToIPFSHelperUtil,
  createTicketURIHelperUtil,
} from '../utils/ipfs-helper.util.ts';
import EventContractABI from '../contracts/EventContract.sol/EventContract.json';
import { useTheme } from '../hooks/theme.hook.ts';
import { colors } from '../config/global.themes';
import LoadingModal from '../components/LoadingModal';
import { useLoadingModal } from '../hooks/useLoadingModal.hook';

interface TicketCategory {
  id: string;
  name: string;
  description: string;
  price: string;
  maxSupply: string;
  image?: File;
}

const AddTicketsPage = () => {
  const { isDark } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { writeContractAsync } = useWriteContract();
  const { address, isConnected } = useAccount();

  // Get the navigation state with contract addresses and event details
  const navigationState = location.state as AddTicketsNavigationState | null;

  // Loading modal state
  const {
    isOpen: isLoadingModalOpen,
    action: loadingAction,
    customMessage: loadingMessage,
    progress: loadingProgress,
    onClose: modalOnClose,
    actionButton: modalActionButton,
    showMetadataUploadModal,
    showContractDeploymentModal,
    showTransactionPendingModal,
    showSuccessModal,
    showErrorModal,
    hideLoadingModal,
    updateMessage,
    updateProgress,
  } = useLoadingModal();

  // State management
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TicketCategory | null>(
    null,
  );



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
      // Check wallet connection
      if (!isConnected || !address) {
        alert('Please connect your wallet to add ticket categories');
        return;
      }

      // Check if we have an event contract address
      if (!navigationState?.eventContract) {
        alert('Event contract address not found');
        return;
      }

      if (categories.length === 0) {
        alert('Please add at least one ticket category');
        return;
      }

      // Show initial loading modal
      showMetadataUploadModal('Processing ticket categories...', 0);

      // Process all categories using Promise.all to handle async operations properly
      const processedCategories = await Promise.all(
        categories.map(async (category, index) => {
          const progress = ((index + 1) / categories.length) * 60; // 60% for image processing
          updateProgress(progress);
          updateMessage(`Processing ${category.name} category...`);

          let imageURI;
          if (category.image) {
            updateMessage(`Uploading ${category.name} image to IPFS...`);
            const imageCID = await uploadImageToIPFSHelperUtil(category.image);
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

          updateMessage(`Creating metadata for ${category.name}...`);
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

      updateProgress(80);
      updateMessage('Finalizing ticket metadata...');
      
      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 500));
      
      updateProgress(100);

      // Switch to contract deployment modal
      showContractDeploymentModal('Adding ticket categories to smart contract...');
      updateMessage('Waiting for wallet confirmation...');

      // Call the smart contract
      try {
        const result = await writeContractAsync({
          address: navigationState.eventContract as `0x${string}`,
          abi: EventContractABI.abi,
          functionName: 'addTicketCategories',
          args: [processedCategories],
        });

        console.log('Transaction hash:', result);
        
        // Show transaction pending
        showTransactionPendingModal('Transaction submitted to blockchain...');
        updateMessage('Waiting for blockchain confirmation...');

        // Simulate transaction confirmation wait
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Show success modal
        showSuccessModal(
          'Ticket categories added successfully! 🎉',
          {
            text: 'Continue to Home',
            onClick: () => {
              hideLoadingModal();
              navigate('/');
            }
          },
          () => {
            hideLoadingModal();
            navigate('/');
          }
        );
      } catch (contractError) {
        console.error('Contract call failed:', contractError);
        const errorMessage =
          contractError instanceof Error
            ? contractError.message
            : 'Unknown contract error';
        
        showErrorModal(
          `Failed to add ticket categories: ${errorMessage}`,
          {
            text: 'Try Again',
            onClick: () => {
              hideLoadingModal();
            }
          },
          () => {
            hideLoadingModal();
          }
        );
      }
    } catch (error) {
      console.error('Error processing categories:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      
      showErrorModal(
        `Error processing categories: ${errorMessage}`,
        {
          text: 'Try Again',
          onClick: () => {
            hideLoadingModal();
          }
        },
        () => {
          hideLoadingModal();
        }
      );
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
        <div
          className={`${
            isDark ? 'bg-gray-900' : 'bg-white'
          } rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col transition-colors duration-300`}
        >
          <form
            onSubmit={handleSubmit}
            className="flex flex-col h-full min-h-0"
          >
            {/* Fixed Header */}
            <div
              className={`px-6 py-4 border-b ${
                isDark ? 'border-gray-700' : 'border-gray-200'
              } flex-shrink-0 transition-colors duration-300`}
            >
              <h3
                className={`text-xl font-semibold ${
                  isDark ? 'text-white' : 'text-gray-900'
                } transition-colors duration-300`}
              >
                {category.id ? 'Edit' : 'Add'} Ticket Category
              </h3>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 min-h-0">
              {/* Category Name */}
              <div>
                <label
                  className={`block text-sm font-medium ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  } mb-2 transition-colors duration-300`}
                >
                  Category Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className={`w-full px-4 py-3 border ${
                    isDark
                      ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                      : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                  } rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200`}
                  style={{ '--tw-ring-color': colors.primary } as React.CSSProperties}
                  placeholder="e.g., VIP, General Admission, Early Bird"
                  required
                />
              </div>
              {/* Description */}
              <div>
                <label
                  className={`block text-sm font-medium ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  } mb-2 transition-colors duration-300`}
                >
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
                  className={`w-full px-4 py-3 border ${
                    isDark
                      ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                      : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                  } rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200`}
                  style={{ '--tw-ring-color': colors.primary } as React.CSSProperties}
                  placeholder="Describe what this ticket category includes..."
                  required
                />
              </div>
              {/* Price and Supply */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    className={`block text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    } mb-2 transition-colors duration-300`}
                  >
                    Price (ETH) *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    min="0"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        price: e.target.value,
                      }))
                    }
                    className={`w-full px-4 py-3 border ${
                      isDark
                        ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                        : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                    } rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200`}
                    style={{ '--tw-ring-color': colors.primary } as React.CSSProperties}
                    placeholder="0.1"
                    required
                  />
                </div>
                <div>
                  <label
                    className={`block text-sm font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    } mb-2 transition-colors duration-300`}
                  >
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
                    className={`w-full px-4 py-3 border ${
                      isDark
                        ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                        : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                    } rounded-xl focus:ring-2 focus:border-transparent transition-all duration-200`}
                    style={{ '--tw-ring-color': colors.primary } as React.CSSProperties}
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
                <label
                  className={`block text-sm font-medium ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  } mb-2 transition-colors duration-300`}
                >
                  Ticket Design Image
                </label>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    isDragActive
                      ? `hover:bg-gray-50`
                      : isDark
                        ? 'border-gray-600 hover:bg-gray-700'
                        : 'border-gray-300 hover:bg-gray-50'
                  }`}
                  style={{
                    borderColor: isDragActive ? colors.primary : undefined,
                    backgroundColor: isDragActive ? `${colors.primary}10` : undefined,
                  }}
                >
                  <input {...getInputProps()} />
                  {formData.image ? (
                    <div className="space-y-2">
                      <img
                        src={URL.createObjectURL(formData.image)}
                        alt="Ticket design"
                        className="mx-auto h-24 w-24 object-cover rounded-lg"
                      />
                      <p
                        className={`text-sm ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        } transition-colors duration-300`}
                      >
                        {formData.image.name}
                      </p>
                      <p
                        className={`text-xs ${
                          isDark ? 'text-gray-500' : 'text-gray-500'
                        } transition-colors duration-300`}
                      >
                        Click or drag to replace
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div
                        className={`mx-auto w-12 h-12 ${
                          isDark ? 'bg-gray-700' : 'bg-gray-200'
                        } rounded-full flex items-center justify-center transition-colors duration-300`}
                      >
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
                      <p
                        className={`text-sm ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        } transition-colors duration-300`}
                      >
                        {isDragActive
                          ? 'Drop image here'
                          : 'Drag & drop or click to upload'}
                      </p>
                      <p
                        className={`text-xs ${
                          isDark ? 'text-gray-500' : 'text-gray-500'
                        } transition-colors duration-300`}
                      >
                        PNG, JPG, GIF up to 5MB
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Fixed Footer */}
            <div
              className={`px-6 py-4 border-t ${
                isDark
                  ? 'border-gray-700 bg-gray-900'
                  : 'border-gray-200 bg-white'
              } flex-shrink-0 transition-colors duration-300 rounded-b-2xl`}
            >
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onCancel}
                  className={`px-4 py-2 ${
                    isDark
                      ? 'text-gray-300 bg-gray-800 hover:bg-gray-700'
                      : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                  } rounded-lg transition-colors`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-white rounded-lg transition-colors font-medium"
                  style={{ backgroundColor: colors.primary }}
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = colors.primaryHover}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = colors.primary}
                >
                  {category.id ? 'Update' : 'Add'} Category
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  };

  


  // If no state was passed, redirect back to create event
  useEffect(() => {
    if (!navigationState) {
      console.warn('No event data found. Redirecting to create event page.');
      navigate('/new-event');
    }
  }, [navigationState, navigate]);

  if (!navigationState) {
    return (
      <div
        className={`min-h-screen ${
          isDark ? 'bg-black' : 'bg-white'
        } flex items-center justify-center transition-colors duration-300`}
      >
        <div className="text-center">
          <h2
            className={`text-2xl font-bold ${
              isDark ? 'text-white' : 'text-gray-900'
            } mb-4 transition-colors duration-300`}
          >
            Loading...
          </h2>
          <p
            className={`${
              isDark ? 'text-gray-400' : 'text-gray-600'
            } transition-colors duration-300`}
          >
            Redirecting to create event page...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${
        isDark ? 'bg-black' : 'bg-gray-50'
      } transition-colors duration-300`}
    >
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1
            className={`text-3xl font-bold ${
              isDark ? 'text-white' : 'text-gray-900'
            } mb-2 transition-colors duration-300`}
          >
            Add Ticket Categories
          </h1>
          <p
            className={`${
              isDark ? 'text-gray-400' : 'text-gray-600'
            } transition-colors duration-300`}
          >
            Configure ticket categories for your event:{' '}
            <span className="font-semibold">{navigationState?.eventTitle}</span>
          </p>
        </div>

        {/* Ticket Categories Configuration */}
        <div
          className={`${
            isDark
              ? 'bg-gray-900 border-gray-700 shadow-sm shadow-black/20'
              : 'bg-white border-gray-200 shadow-sm'
          } rounded-2xl border p-8 mb-6 transition-colors duration-300`}
        >
          <div className="flex justify-between items-center mb-6">
            <h2
              className={`text-xl font-semibold ${
                isDark ? 'text-white' : 'text-gray-900'
              } transition-colors duration-300`}
            >
              Ticket Categories
            </h2>
            <button
              onClick={addCategory}
              disabled={categories.length >= 5}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                categories.length >= 5
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'text-white'
              }`}
              style={categories.length >= 5 ? {} : { backgroundColor: colors.primary }}
              onMouseEnter={(e) => {
                if (categories.length < 5) {
                  (e.target as HTMLButtonElement).style.backgroundColor = colors.primaryHover;
                }
              }}
              onMouseLeave={(e) => {
                if (categories.length < 5) {
                  (e.target as HTMLButtonElement).style.backgroundColor = colors.primary;
                }
              }}
            >
              Add Category {categories.length > 0 && `(${categories.length}/5)`}
            </button>
          </div>

          {categories.length === 0 ? (
            <div
              className={`text-center py-12 ${
                isDark ? 'bg-gray-800' : 'bg-gray-50'
              } rounded-xl transition-colors duration-300`}
            >
              <div
                className={`w-16 h-16 mx-auto mb-4 ${
                  isDark ? 'bg-gray-700' : 'bg-gray-200'
                } rounded-full flex items-center justify-center transition-colors duration-300`}
              >
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
              <h3
                className={`text-lg font-medium ${
                  isDark ? 'text-white' : 'text-gray-900'
                } mb-2 transition-colors duration-300`}
              >
                No ticket categories yet
              </h3>
              <p
                className={`${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                } mb-4 transition-colors duration-300`}
              >
                Add your first ticket category to get started
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className={`border ${
                    isDark ? 'border-gray-700' : 'border-gray-200'
                  } rounded-xl p-6 transition-colors duration-300`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3
                        className={`text-lg font-semibold ${
                          isDark ? 'text-white' : 'text-gray-900'
                        } mb-1 transition-colors duration-300`}
                      >
                        {category.name}
                      </h3>
                      <p
                        className={`${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        } text-sm mb-2 transition-colors duration-300`}
                      >
                        {category.description}
                      </p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span 
                          className="font-medium"
                          style={{ color: colors.accent }}
                        >
                          {category.price} ETH
                        </span>
                        <span style={{ color: colors.info }}>
                          Max: {category.maxSupply} tickets
                        </span>
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
                        className={`p-2 ${
                          isDark
                            ? 'text-gray-400 hover:text-gray-200'
                            : 'text-gray-400 hover:text-gray-600'
                        } transition-colors`}
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
                        className="p-2 transition-colors"
                        style={{ color: colors.error }}
                        onMouseEnter={(e) => (e.target as HTMLButtonElement).style.color = colors.errorHover}
                        onMouseLeave={(e) => (e.target as HTMLButtonElement).style.color = colors.error}
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

        {/* Event Details Summary */}
        <div
          className={`${
            isDark
              ? 'bg-blue-900/20 border-blue-700/50'
              : 'bg-blue-50 border-blue-200'
          } border rounded-xl p-6 mb-6 transition-colors duration-300`}
        >
          <h3
            className={`font-medium ${
              isDark ? 'text-blue-300' : 'text-blue-900'
            } mb-3 transition-colors duration-300`}
          >
            Event Summary
          </h3>
          <div
            className={`grid grid-cols-1 md:grid-cols-2 gap-4 text-sm ${
              isDark ? 'text-blue-300' : 'text-blue-800'
            } transition-colors duration-300`}
          >
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
            className={`px-6 py-3 ${
              isDark
                ? 'text-gray-300 bg-gray-800 hover:bg-gray-700'
                : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
            } rounded-xl transition-colors font-medium`}
          >
            Back
          </button>
          <button
            disabled={isLoadingModalOpen}
            onClick={handleTicketCategoriesAdded}
            className={`px-8 py-3 rounded-xl transition-colors font-medium ${
              isLoadingModalOpen
                ? 'text-gray-200 cursor-not-allowed'
                : 'text-white'
            }`}
            style={isLoadingModalOpen 
              ? { backgroundColor: `${colors.primary}60` } 
              : { backgroundColor: colors.primary }
            }
            onMouseEnter={(e) => {
              if (!isLoadingModalOpen) {
                (e.target as HTMLButtonElement).style.backgroundColor = colors.primaryHover;
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoadingModalOpen) {
                (e.target as HTMLButtonElement).style.backgroundColor = colors.primary;
              }
            }}
          >
            {isLoadingModalOpen ? (
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
                Processing...
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


      
              {/* Loading Modal */}
        <LoadingModal
          isOpen={isLoadingModalOpen}
          action={loadingAction}
          customMessage={loadingMessage}
          progress={loadingProgress}
          onClose={modalOnClose}
          actionButton={modalActionButton}
        />
    </div>
  );
};

export default AddTicketsPage;
