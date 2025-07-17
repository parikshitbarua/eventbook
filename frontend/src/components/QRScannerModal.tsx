import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useTheme } from '../hooks/theme.hook.ts';
import { colors } from '../config/global.themes';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import EventTicketNFTABI from '../contracts/EventTicketNFT.sol/EventTicketNFT.json';
import API_ENDPOINTS from "../config/api.config.ts";

interface QRData {
  tokenId: string;
  eventId: string;
  owner: string;
  expiresAt: string;
  serverSignature: string;
}

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  nftContractAddress: string;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose, eventId, nftContractAddress }) => {
  const { isDark } = useTheme();
  const { isConnected } = useAccount();
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [scannedData, setScannedData] = useState<QRData | null>(null);
  const [verifiedData, setVerifiedData] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [isScanning, setIsScanning] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAdmitting, setIsAdmitting] = useState(false);
  const [isAdmitted, setIsAdmitted] = useState(false);

  const { writeContract, data: hash, error: writeError, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (isOpen && isScanning) {
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        false
      );

      scannerRef.current = scanner;

      scanner.render(
        async (decodedText) => {
          try {
            const qrData: QRData = JSON.parse(decodedText);
            console.log(qrData);
            
            // Validate required fields
            if (qrData.tokenId == null || qrData.eventId == null || !qrData.owner || !qrData.expiresAt || !qrData.serverSignature) {
              setError('Invalid QR code format - missing required fields');
              return;
            }

            // Check if QR code is for the correct event
            if (Number(qrData.eventId) !== Number(eventId)) {
              setError(`This ticket is for a different event (Event ID: ${qrData.eventId})`);
              return;
            }

            // Check if ticket has expired
            const expirationTime = parseInt(qrData.expiresAt);
            const currentTime = Math.floor(Date.now() / 1000);

            
            if (currentTime > expirationTime) {
              setError('This ticket has expired');
              return;
            }

            setScannedData(qrData);
            setIsScanning(false);

            scanner.clear();
            
            // Verify the QR data with the backend
            verifyQRData(qrData);

          } catch (err) {
            setError('Invalid QR code format - could not parse JSON');
          }
        },
        (_error) => {
          // console.log('QR scanning error:', _error);
        }
      );

      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear();
        }
      };
    }
  }, [isOpen, isScanning, eventId]);

  // Handle transaction success
  useEffect(() => {
    if (isConfirmed) {
      setError('');
      setIsAdmitting(false);
      setIsAdmitted(true);
    }
  }, [isConfirmed]);

  // Handle transaction error
  useEffect(() => {
    if (writeError) {
      console.error('Transaction error:', writeError);
      
      // Extract meaningful error message
      let errorMessage = 'Transaction failed';
      
      if (writeError.message.includes('User rejected')) {
        errorMessage = 'Transaction was rejected by user';
      } else if (writeError.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for gas fees';
      } else if (writeError.message.includes('Already used')) {
        errorMessage = 'This ticket has already been used';
      } else if (writeError.message.includes('Ticket already used')) {
        errorMessage = 'This ticket has already been used';
      } else if (writeError.message.includes('Not ticket owner')) {
        errorMessage = 'Only the ticket owner can use this ticket';
      } else if (writeError.message.includes('execution reverted')) {
        // Try to extract revert reason from different formats
        const revertMatch = writeError.message.match(/execution reverted: (.+)/);
        const errorMatch = writeError.message.match(/Fail with error '(.+)'/);
        
        if (errorMatch) {
          const contractError = errorMatch[1];
          if (contractError === 'Already used') {
            errorMessage = 'This ticket has already been used';
          } else {
            errorMessage = `Contract error: ${contractError}`;
          }
        } else if (revertMatch) {
          errorMessage = `Contract error: ${revertMatch[1]}`;
        } else {
          errorMessage = 'Transaction failed - contract execution reverted';
        }
      } else {
        errorMessage = `Transaction failed: ${writeError.message}`;
      }
      
      setError(errorMessage);
      setIsAdmitting(false);
    }
  }, [writeError]);

  const verifyQRData = async (qrData: QRData) => {
    setIsVerifying(true);
    try {
      const response = await fetch(API_ENDPOINTS.VERIFY_QR, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...qrData,
          nftContractAddress
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message || 'Failed to verify QR code');
        setIsVerifying(false);
        return;
      }

      // Successfully verified
      setVerifiedData(result.data);
      setError('');
    } catch (err) {
      console.error('Error verifying QR data:', err);
      setError('Network error - could not verify QR code');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
    }
    setScannedData(null);
    setVerifiedData(null);
    setError('');
    setIsScanning(true);
    setIsVerifying(false);
    setIsAdmitting(false);
    setIsAdmitted(false);
    onClose();
  };

  const handleAdmit = async () => {
    if (!verifiedData || !nftContractAddress) {
      setError('Missing verified data or contract address');
      return;
    }

    if (!isConnected) {
      setError('Please connect your wallet to admit tickets');
      return;
    }

    setIsAdmitting(true);
    setError('');

    try {
      // Call the useTicket function on the NFT contract
      writeContract({
        address: nftContractAddress as `0x${string}`,
        abi: EventTicketNFTABI.abi,
        functionName: 'useTicket',
        args: [BigInt(verifiedData.tokenId)],
      });
    } catch (error) {
      console.error('Failed to admit ticket:', error);
      setError('Failed to admit ticket. Please try again.');
      setIsAdmitting(false);
    }
  };

  const handleRetry = () => {
    setScannedData(null);
    setVerifiedData(null);
    setError('');
    setIsScanning(true);
    setIsVerifying(false);
    setIsAdmitting(false);
    setIsAdmitted(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`max-w-md w-full rounded-lg shadow-xl ${
        isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
      } transition-colors duration-300`}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Scan Ticket QR Code</h2>
            <button
              onClick={handleClose}
              className={`p-2 rounded-full hover:bg-opacity-10 ${
                isDark ? 'hover:bg-white' : 'hover:bg-black'
              } transition-colors`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {isScanning && !scannedData && (
            <div>
              <div id="qr-reader" className="mb-4"></div>
              <p className={`text-sm text-center ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Position the QR code within the frame to scan
              </p>
            </div>
          )}

          {scannedData && !isAdmitted && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium mb-3">Ticket Information</h3>
              
              {isVerifying && (
                <div className="flex items-center justify-center py-4">
                  <svg
                    className="animate-spin h-6 w-6 mr-3"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    style={{ color: colors.primary }}
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
                  <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                    Verifying ticket authenticity...
                  </span>
                </div>
              )}

              {verifiedData && (
                <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Ticket verified successfully!
                </div>
              )}
              
              <div className={`p-4 rounded-lg ${
                isDark ? 'bg-gray-800' : 'bg-gray-50'
              }`}>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div>
                    <span className={`font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>Token ID:</span>
                    <span className="ml-2">{verifiedData?.tokenId || scannedData.tokenId}</span>
                  </div>
                  <div>
                    <span className={`font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>Event ID:</span>
                    <span className="ml-2">{verifiedData?.eventId || scannedData.eventId}</span>
                  </div>
                  <div>
                    <span className={`font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>Owner:</span>
                    <span className="ml-2 font-mono text-xs break-all">{verifiedData?.owner || scannedData.owner}</span>
                  </div>
                  <div>
                    <span className={`font-medium ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>Expires At:</span>
                    <span className="ml-2">{new Date((verifiedData?.expiresAt || scannedData.expiresAt) * 1000).toLocaleString()}</span>
                  </div>
                  {verifiedData && (
                    <div>
                      <span className={`font-medium ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}>Status:</span>
                      <span className="ml-2 text-green-600 font-semibold">Verified ✓</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                    isDark
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Scan Another
                </button>
                <button
                  onClick={handleAdmit}
                  disabled={isAdmitting || isVerifying || !verifiedData || isPending || isConfirming || !nftContractAddress}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isPending ? 'Confirming...' : isConfirming ? 'Processing...' : isAdmitting ? 'Admitting...' : 'Admit'}
                </button>
              </div>
            </div>
          )}

          {isAdmitted && (
            <div className="space-y-6 text-center">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-green-600 mb-2">
                  Ticket Admitted Successfully!
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  The attendee has been granted access to the event.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                    isDark
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Scan Another
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRScannerModal; 