import { useState, useCallback } from 'react';
import { LoadingAction } from '../components/LoadingModal';

interface LoadingModalState {
  isOpen: boolean;
  action: LoadingAction;
  customMessage?: string;
  progress?: number;
  onClose?: () => void;
  actionButton?: {
    text: string;
    onClick: () => void;
  };
}

export const useLoadingModal = () => {
  const [state, setState] = useState<LoadingModalState>({
    isOpen: false,
    action: 'generic-loading',
    customMessage: undefined,
    progress: undefined,
    onClose: undefined,
    actionButton: undefined,
  });

  const showLoadingModal = useCallback((
    action: LoadingAction,
    customMessage?: string,
    progress?: number
  ) => {
    setState({
      isOpen: true,
      action,
      customMessage,
      progress,
    });
  }, []);

  const updateProgress = useCallback((progress: number) => {
    setState(prev => ({
      ...prev,
      progress,
    }));
  }, []);

  const updateMessage = useCallback((customMessage: string) => {
    setState(prev => ({
      ...prev,
      customMessage,
    }));
  }, []);

  const hideLoadingModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  // Helper methods for specific actions
  const showTicketPurchaseModal = useCallback((customMessage?: string) => {
    showLoadingModal('ticket-purchase', customMessage);
  }, [showLoadingModal]);

  const showEventCreationModal = useCallback((customMessage?: string) => {
    showLoadingModal('event-creation', customMessage);
  }, [showLoadingModal]);

  const showMetadataUploadModal = useCallback((customMessage?: string, progress?: number) => {
    showLoadingModal('metadata-upload', customMessage, progress);
  }, [showLoadingModal]);

  const showTransactionPendingModal = useCallback((customMessage?: string) => {
    showLoadingModal('transaction-pending', customMessage);
  }, [showLoadingModal]);

  const showContractDeploymentModal = useCallback((customMessage?: string) => {
    showLoadingModal('contract-deployment', customMessage);
  }, [showLoadingModal]);

  const showSuccessModal = useCallback((customMessage?: string, actionButton?: { text: string; onClick: () => void }, onClose?: () => void) => {
    setState({
      isOpen: true,
      action: 'success',
      customMessage,
      progress: undefined,
      onClose,
      actionButton,
    });
  }, []);

  const showErrorModal = useCallback((customMessage?: string, actionButton?: { text: string; onClick: () => void }, onClose?: () => void) => {
    setState({
      isOpen: true,
      action: 'error',
      customMessage,
      progress: undefined,
      onClose,
      actionButton,
    });
  }, []);

  return {
    ...state,
    showLoadingModal,
    hideLoadingModal,
    updateProgress,
    updateMessage,
    // Helper methods
    showTicketPurchaseModal,
    showEventCreationModal,
    showMetadataUploadModal,
    showTransactionPendingModal,
    showContractDeploymentModal,
    showSuccessModal,
    showErrorModal,
  };
}; 