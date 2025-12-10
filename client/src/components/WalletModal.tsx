'use client';
import { useState, useEffect, useCallback } from 'react';
import { Icons } from './Icons';
import { getNonce, linkWallet as apiLinkWallet, addSecondaryWallet, getUser, User } from '../lib/api';

// Types
interface WalletProvider {
  id: string;
  name: string;
  icon: React.ReactNode;
  isConnected?: boolean;
  isInstalled?: boolean;
}

export interface LinkedWallet {
  address: string;
  isPrimary: boolean;
  balance: string;
  linkedAt?: Date;
  provider?: string;
}

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect?: (providerId: string) => Promise<void>;
  onWalletLinked?: (wallet: LinkedWallet) => void;
  onUserUpdated?: (user: User) => void;
  connectedAddress?: string;
  linkedWallets?: LinkedWallet[];
  currentUser?: User | null;  // Current logged-in user (for multi-wallet linking)
}

// Toast notification types
type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

// Helper to check if window.ethereum exists
const hasEthereum = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).ethereum;
};

// Wallet Provider Icons
const WalletIcons = {
  MetaMask: () => (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      <defs>
        <linearGradient id="metamask-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E17726" />
          <stop offset="100%" stopColor="#CD6116" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="8" fill="url(#metamask-gradient)" />
      <path d="M28.5 11L21 16.5l1.4-5.3L28.5 11z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.5 11l7.4 5.6-1.3-5.4-6.1-.2zm14.4 14.5l-2 4.8 4.2 1.2 1.2-4.1-3.4-1.9zm-17.2 1.9l1.2 4.1 4.2-1.2-2-4.8-3.4 1.9z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.7 19.2l-2.3 3.5 4.1.2-.1-3.9-1.7.2zm12.6 0l-1.8-.3-.1 4 4.1-.2-2.2-3.5zm-12.2 8.3l2.5-1.2-2.2-1.7-.3 2.9zm7.3-1.2l2.5 1.2-.3-2.9-2.2 1.7z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  MetaMaskSmall: () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <defs>
        <linearGradient id="metamask-sm-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E17726" />
          <stop offset="100%" stopColor="#CD6116" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="4" fill="url(#metamask-sm-gradient)" />
      <path d="M17.1 6.6L12.6 9.9l.84-3.18L17.1 6.6z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.9 6.6l4.44 3.36-.78-3.24-3.66-.12zm8.64 8.7l-1.2 2.88 2.52.72.72-2.46-2.04-1.14zm-10.32 1.14l.72 2.46 2.52-.72-1.2-2.88-2.04 1.14z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Coinbase: () => (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      <rect width="40" height="40" rx="8" fill="#0052FF" />
      <circle cx="20" cy="20" r="12" fill="white" />
      <rect x="15" y="15" width="10" height="10" rx="2" fill="#0052FF" />
    </svg>
  ),
  WalletConnect: () => (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      <rect width="40" height="40" rx="8" fill="#3B99FC" />
      <path d="M13 16c4-4 10-4 14 0l.5.5c.2.2.2.5 0 .7l-1.6 1.6c-.1.1-.3.1-.4 0l-.6-.6c-2.8-2.8-7.2-2.8-10 0l-.7.7c-.1.1-.3.1-.4 0l-1.6-1.6c-.2-.2-.2-.5 0-.7L13 16zm17.3 3.2l1.4 1.4c.2.2.2.5 0 .7l-6.4 6.4c-.2.2-.5.2-.7 0l-4.6-4.5c0-.1-.1-.1-.2 0l-4.6 4.5c-.2.2-.5.2-.7 0l-6.4-6.4c-.2-.2-.2-.5 0-.7l1.4-1.4c.2-.2.5-.2.7 0l4.6 4.5c0 .1.1.1.2 0l4.6-4.5c.2-.2.5-.2.7 0l4.6 4.5c0 .1.1.1.2 0l4.6-4.5c.2-.2.5-.2.7 0z" fill="white" />
    </svg>
  ),
  Abstract: () => (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      <rect width="40" height="40" rx="8" fill="#00C853" />
      <path d="M20 8L8 32h24L20 8zm0 6l8 14H12l8-14z" fill="white" />
    </svg>
  ),
  Phantom: () => (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      <defs>
        <linearGradient id="phantom-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#534BB1" />
          <stop offset="100%" stopColor="#551BF9" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="8" fill="url(#phantom-gradient)" />
      <ellipse cx="20" cy="22" rx="10" ry="8" fill="white" opacity="0.9" />
      <circle cx="15" cy="21" r="2" fill="#534BB1" />
      <circle cx="25" cy="21" r="2" fill="#534BB1" />
    </svg>
  ),
  // App Logo (ChainGuard)
  AppLogo: () => (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      <defs>
        <linearGradient id="app-logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#app-logo-gradient)" />
      <path d="M20 10L10 30h20L20 10z" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 25l5-10 5 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="18" r="2" fill="white" />
    </svg>
  ),
  // Double Arrow (ArrowRightLeft)
  ArrowRightLeft: () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3L4 7l4 4" />
      <path d="M4 7h16" />
      <path d="M16 21l4-4-4-4" />
      <path d="M20 17H4" />
    </svg>
  ),
};

// Avatar generator based on address
function WalletAvatar({ address, size = 'md' }: { address: string; size?: 'sm' | 'md' | 'lg' }) {
  const colors = ['from-red-500 to-pink-600', 'from-blue-500 to-purple-600', 'from-green-500 to-emerald-600', 'from-orange-500 to-amber-600'];
  const colorIndex = parseInt(address.slice(-1), 16) % colors.length;
  const sizeClass = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-14 h-14' : 'w-10 h-10';
  
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center`}>
      <span className="text-white text-lg">🤖</span>
    </div>
  );
}

// Truncate address
function truncateAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Link Confirmation View Sub-Component
interface LinkConfirmationViewProps {
  candidateAddress: string;
  providerName: string;
  balance: string;
  isLoadingBalance: boolean;
  onConfirm: () => void;
  onSwitchAccounts: () => void;
  onBack: () => void;
  isLinking?: boolean;
  isSigning?: boolean;
  isSwitchingAccount?: boolean;
}

function LinkConfirmationView({
  candidateAddress,
  providerName,
  balance,
  isLoadingBalance,
  onConfirm,
  onSwitchAccounts,
  onBack,
  isLinking = false,
  isSigning = false,
  isSwitchingAccount = false,
}: LinkConfirmationViewProps) {
  return (
    <div className="flex flex-col">
      {/* Close/Back Button Row */}
      <div className="p-4 flex items-center justify-between">
        <button
          onClick={onBack}
          disabled={isLinking || isSigning}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-800/80 transition-colors inline-flex items-center gap-2 text-gray-400 hover:text-white disabled:opacity-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={onBack}
          disabled={isLinking || isSigning}
          className="p-2 rounded-lg hover:bg-gray-800/80 transition-colors text-gray-400 hover:text-white disabled:opacity-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Header with Icons */}
      <div className="px-6 pb-6">
        {/* Icon Row: MetaMask <-> App Logo */}
        <div className="flex items-center justify-center gap-5 mb-8">
          {/* MetaMask Icon - Larger with glow */}
          <div className="relative">
            <div className="absolute inset-0 bg-orange-500/30 blur-xl rounded-full" />
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-lg">
              <WalletIcons.MetaMask />
            </div>
          </div>
          
          {/* Double Arrow - Styled */}
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-800/50">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3L4 7l4 4" />
              <path d="M4 7h16" />
              <path d="M16 21l4-4-4-4" />
              <path d="M20 17H4" />
            </svg>
          </div>
          
          {/* App Logo - ChainGuard with glow */}
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/30 blur-xl rounded-full" />
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-lg">
              <WalletIcons.AppLogo />
            </div>
          </div>
        </div>

        {/* Title & Description */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-3">
            {isSigning ? 'Sign Message in Wallet' : 'Link this wallet to your account'}
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">
            {isSigning ? (
              'Please sign the message in MetaMask to verify you own this wallet. This is free and does not cost any gas.'
            ) : (
              <>
                You&apos;re about to link wallet{' '}
                <span className="text-white font-mono bg-gray-800/50 px-1.5 py-0.5 rounded">{truncateAddress(candidateAddress)}</span>
                {' '}to your current account. If you want to use a different wallet, click{' '}
                <span className="text-blue-400">Switch Accounts</span>.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Wallet Info Card */}
      <div className="px-6 pb-6">
        <div className={`bg-[#12121a] rounded-2xl p-4 border-2 transition-all duration-300 ${
          isSigning 
            ? 'border-blue-500/60 shadow-lg shadow-blue-500/10' 
            : 'border-gray-800/80 hover:border-gray-700/80'
        }`}>
          <div className="flex items-start gap-4">
            {/* Wallet Avatar - Larger blockie style */}
            <div className="relative flex-shrink-0">
              <WalletAvatar address={candidateAddress} size="lg" />
              {isSigning && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              )}
            </div>
            
            {/* Wallet Details */}
            <div className="flex-1 min-w-0">
              {/* Address Row with Badge */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-white font-semibold font-mono text-lg">
                  {truncateAddress(candidateAddress)}
                </span>
                <span className="px-2 py-1 rounded-md text-xs font-semibold uppercase tracking-wide bg-gray-700/80 text-gray-300 border border-gray-600/50">
                  Not Linked
                </span>
              </div>
              
              {/* Provider & Balance Row */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded overflow-hidden">
                    <svg viewBox="0 0 24 24" className="w-4 h-4">
                      <defs>
                        <linearGradient id="mm-tiny" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#E17726" />
                          <stop offset="100%" stopColor="#CD6116" />
                        </linearGradient>
                      </defs>
                      <rect width="24" height="24" rx="4" fill="url(#mm-tiny)" />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-400">{providerName}</span>
                </div>
                <span className="text-gray-600">•</span>
                {/* Balance with Loading State */}
                {isLoadingBalance ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 border-2 border-gray-500/30 border-t-gray-400 rounded-full animate-spin" />
                    <span className="text-sm text-gray-500">Loading...</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 font-mono">{balance || '—'}</span>
                )}
              </div>
            </div>
          </div>

          {/* Signing Progress Indicator */}
          {isSigning && (
            <div className="mt-4 pt-4 border-t border-gray-700/50">
              <div className="flex items-center justify-center gap-3 py-2">
                <div className="relative">
                  <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                </div>
                <span className="text-blue-400 text-sm font-medium">Waiting for signature...</span>
              </div>
              <p className="text-xs text-gray-500 text-center mt-2">
                Check MetaMask and sign the message to continue
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {!isSigning && (
        <div className="px-6 pb-4 flex gap-3">
          {/* Switch Accounts Button - Secondary */}
          <button
            onClick={onSwitchAccounts}
            disabled={isLinking || isSwitchingAccount}
            className="flex-1 py-3.5 px-4 bg-transparent hover:bg-gray-800/80 text-white font-semibold rounded-xl border-2 border-gray-700 hover:border-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {isSwitchingAccount ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Switching...</span>
              </>
            ) : (
              'Switch accounts'
            )}
          </button>
          
          {/* Link Wallet Button - Primary Blue */}
          <button
            onClick={onConfirm}
            disabled={isLinking || isSwitchingAccount}
            className="flex-1 py-3.5 px-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-[0.98]"
          >
            {isLinking ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Linking...</span>
              </>
            ) : (
              'Link wallet to account'
            )}
          </button>
        </div>
      )}

      {/* Footer Info - Security Note */}
      <div className="px-6 pb-6">
        <div className="flex items-start gap-2 p-3 bg-gray-800/30 rounded-xl border border-gray-800/50">
          <svg className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-gray-500 leading-relaxed">
            {isSigning 
              ? 'This signature verifies wallet ownership. It\'s free and doesn\'t send any transaction.'
              : 'You will be asked to sign a message to verify ownership. This is free and does not cost any gas fees.'
            }
          </p>
        </div>
      </div>
    </div>
  );
}

export function WalletModal({ 
  isOpen, 
  onClose, 
  onConnect,
  onWalletLinked,
  onUserUpdated,
  connectedAddress,
  linkedWallets = [],
  currentUser = null
}: WalletModalProps) {
  // View state: 'list' | 'management' | 'confirmation' | 'signing'
  const [viewState, setViewState] = useState<'list' | 'management' | 'confirmation' | 'signing'>('list');
  const [email, setEmail] = useState('');
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  
  // Web3 State
  const [candidateAddress, setCandidateAddress] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('MetaMask');
  const [isLinking, setIsLinking] = useState(false);
  const [walletBalance, setWalletBalance] = useState<string>('');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Track if this is a secondary wallet link (user already has account)
  const isSecondaryWalletLink = currentUser !== null;
  // Internal linked wallets state (merge with props)
  const [internalLinkedWallets, setInternalLinkedWallets] = useState<LinkedWallet[]>(linkedWallets);

  // Toast helper
  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Check if wallet is already linked
  const isWalletAlreadyLinked = useCallback((address: string): boolean => {
    const allWallets = [...internalLinkedWallets, ...linkedWallets];
    return allWallets.some(
      (w) => w.address.toLowerCase() === address.toLowerCase()
    );
  }, [internalLinkedWallets, linkedWallets]);

  // Get wallet balance with loading state
  const fetchBalance = useCallback(async (address: string): Promise<string> => {
    if (!hasEthereum() || !address) return '';
    
    setIsLoadingBalance(true);
    
    try {
      const ethereum = (window as any).ethereum;
      const balance = await ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      });
      
      const ethBalance = parseInt(balance, 16) / 1e18;
      const formattedBalance = ethBalance === 0 
        ? '0 ETH' 
        : `${ethBalance.toFixed(4)} ETH`;
      
      setWalletBalance(formattedBalance);
      return formattedBalance;
    } catch (err) {
      console.error('Failed to get balance:', err);
      setWalletBalance('—');
      return '—';
    } finally {
      setIsLoadingBalance(false);
    }
  }, []);

  // ============================================
  // LIVE EVENT LISTENERS (Crucial for real-time updates)
  // ============================================
  useEffect(() => {
    if (!hasEthereum() || !isOpen) return;

    const ethereum = (window as any).ethereum;

    // Handler for account changes - MUST update UI immediately
    const handleAccountsChanged = async (accounts: string[]) => {
      console.log('[WalletModal] accountsChanged event fired:', accounts);
      
      if (accounts.length === 0) {
        // User disconnected all accounts
        showToast('info', 'Wallet disconnected');
        setCandidateAddress('');
        setWalletBalance('');
        setViewState('list');
        return;
      }

      const newAddress = accounts[0];
      console.log('[WalletModal] New address detected:', newAddress);
      
      // Update for ANY view state where we have a candidate (confirmation, signing, or management)
      // This ensures the modal updates immediately when user switches accounts
      if (viewState === 'confirmation' || viewState === 'signing' || viewState === 'management') {
        // Check if new address is already linked
        if (isWalletAlreadyLinked(newAddress)) {
          showToast('error', 'This wallet is already linked to your account.');
          // Still update the display to show the linked wallet
          setCandidateAddress(newAddress);
          await fetchBalance(newAddress);
          return;
        }

        // Update candidate address IMMEDIATELY
        setCandidateAddress(newAddress);
        
        // Fetch and display new balance
        setIsLoadingBalance(true);
        await fetchBalance(newAddress);
        
        showToast('info', `Switched to ${truncateAddress(newAddress)}`);
        console.log('[WalletModal] UI updated with new address:', newAddress);
      }
    };

    // Handler for chain changes
    const handleChainChanged = async (chainId: string) => {
      console.log('[WalletModal] chainChanged event:', chainId);
      
      // Re-fetch balance when chain changes (different chain = different balance)
      if (candidateAddress) {
        await fetchBalance(candidateAddress);
      }
    };

    // Subscribe to events
    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    // Cleanup on unmount or when modal closes
    return () => {
      ethereum.removeListener('accountsChanged', handleAccountsChanged);
      ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [isOpen, viewState, candidateAddress, isWalletAlreadyLinked, fetchBalance, showToast]);

  // Wallet providers configuration
  const walletProviders: WalletProvider[] = [
    { 
      id: 'metamask', 
      name: 'MetaMask', 
      icon: <WalletIcons.MetaMask />,
      isConnected: !!connectedAddress,
      isInstalled: hasEthereum() && !!(window as any).ethereum?.isMetaMask
    },
    { id: 'coinbase', name: 'Coinbase Wallet', icon: <WalletIcons.Coinbase />, isInstalled: false },
    { id: 'walletconnect', name: 'WalletConnect', icon: <WalletIcons.WalletConnect />, isInstalled: true },
    { id: 'abstract', name: 'Abstract', icon: <WalletIcons.Abstract />, isInstalled: false },
  ];

  const additionalProviders: WalletProvider[] = [
    { id: 'phantom', name: 'Phantom', icon: <WalletIcons.Phantom />, isInstalled: false },
  ];

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      const hasLinked = internalLinkedWallets.length > 0 || linkedWallets.length > 0;
      setViewState(hasLinked ? 'management' : 'list');
      setCandidateAddress('');
      setIsLinking(false);
      setIsLoadingBalance(false);
      setError(null);
      setWalletBalance('');
    }
  }, [isOpen, linkedWallets.length, internalLinkedWallets.length]);

  // Sync external linkedWallets prop
  useEffect(() => {
    if (linkedWallets.length > 0) {
      setInternalLinkedWallets((prev) => {
        const merged = [...prev];
        linkedWallets.forEach((w) => {
          if (!merged.some((m) => m.address.toLowerCase() === w.address.toLowerCase())) {
            merged.push(w);
          }
        });
        return merged;
      });
    }
  }, [linkedWallets]);

  // ============================================
  // STEP 1 & 2: Handle wallet connection
  // ============================================
  const handleConnect = async (providerId: string) => {
    // Step 1: Check if MetaMask is installed
    if (!hasEthereum()) {
      showToast('error', 'MetaMask is not installed. Please install MetaMask to continue.');
      return;
    }

    setIsConnecting(providerId);
    setSelectedProvider(walletProviders.find(p => p.id === providerId)?.name || 'Wallet');
    setError(null);
    
    try {
      const ethereum = (window as any).ethereum;
      
      // Step 2: Request account access
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts && accounts.length > 0) {
        const newCandidateAddress = accounts[0];
        
        // Validation: Check if already linked
        if (isWalletAlreadyLinked(newCandidateAddress)) {
          showToast('error', 'This wallet is already linked to your account.');
          setIsConnecting(null);
          return;
        }
        
        // Get balance for display
        await fetchBalance(newCandidateAddress);
        
        // Set candidate and switch to confirmation view
        setCandidateAddress(newCandidateAddress);
        setViewState('confirmation');
      } else {
        showToast('error', 'No accounts found. Please unlock MetaMask.');
      }
    } catch (err: any) {
      if (err.code === 4001) {
        showToast('error', 'Connection rejected. Please approve the connection in MetaMask.');
      } else if (err.code === -32002) {
        showToast('error', 'Connection request pending. Please check MetaMask.');
      } else {
        showToast('error', err.message || 'Failed to connect wallet.');
      }
    } finally {
      setIsConnecting(null);
    }
  };

  // ============================================
  // STEP 3: Switch accounts in MetaMask
  // ============================================
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  
  const handleSwitchAccounts = async () => {
    if (!hasEthereum()) {
      showToast('error', 'MetaMask not detected');
      return;
    }

    setIsSwitchingAccount(true);
    
    try {
      const ethereum = (window as any).ethereum;
      
      console.log('[WalletModal] Requesting wallet_requestPermissions...');
      
      // This FORCES MetaMask to show the account picker popup
      // Even if the user is already connected, this will show the selection UI
      await ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });
      
      console.log('[WalletModal] Permission granted, fetching accounts...');
      
      // After permission is granted, get the selected account
      // The accountsChanged event should fire, but we also fetch directly for reliability
      const accounts = await ethereum.request({ method: 'eth_accounts' });
      
      console.log('[WalletModal] Accounts received:', accounts);
      
      if (accounts && accounts.length > 0) {
        const newAddress = accounts[0];
        
        // Check if this new address is already linked
        if (isWalletAlreadyLinked(newAddress)) {
          showToast('error', 'This wallet is already linked to your account.');
          // Still update the UI to show the selected wallet
          setCandidateAddress(newAddress);
          await fetchBalance(newAddress);
          setIsSwitchingAccount(false);
          return;
        }
        
        // Update candidate address and fetch balance
        setCandidateAddress(newAddress);
        await fetchBalance(newAddress);
        showToast('success', `Switched to ${truncateAddress(newAddress)}`);
      }
    } catch (err: any) {
      console.error('[WalletModal] Switch account error:', err);
      
      if (err.code === 4001) {
        // User rejected - this is fine, just ignore
        console.log('[WalletModal] User rejected account switch');
      } else {
        showToast('error', err.message || 'Failed to switch account.');
      }
    } finally {
      setIsSwitchingAccount(false);
    }
  };

  // ============================================
  // STEP 4 & 5: Sign message and complete linking (WITH BACKEND VERIFICATION)
  // Supports BOTH primary (first) wallet and secondary wallet linking
  // ============================================
  const handleSignAndLink = async () => {
    if (!hasEthereum() || !candidateAddress) return;

    setIsLinking(true);
    setViewState('signing');
    setError(null);

    try {
      const ethereum = (window as any).ethereum;
      
      // Check if this is a SECONDARY wallet link (user already logged in)
      if (isSecondaryWalletLink && currentUser) {
        // ========================================
        // SECONDARY WALLET FLOW
        // User is logged in, adding another wallet
        // ========================================
        
        // The message format for secondary wallet linking
        const message = `Link wallet ${candidateAddress} to ChainGuard account`;
        
        // Convert message to hex for personal_sign
        const encoder = new TextEncoder();
        const msgBytes = encoder.encode(message);
        const msgHex = '0x' + Array.from(msgBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        
        // Request signature from the NEW wallet (proves ownership)
        const signature = await ethereum.request({
          method: 'personal_sign',
          params: [msgHex, candidateAddress],
        });

        if (!signature) {
          throw new Error('Failed to get signature');
        }

        // Send to backend: secondary wallet link endpoint
        const linkResponse = await addSecondaryWallet(candidateAddress, signature, currentUser.id);
        
        if (!linkResponse.success || !linkResponse.data) {
          throw new Error(linkResponse.error?.message || 'Failed to link wallet');
        }

        // Update user state with new wallet list
        if (onUserUpdated && linkResponse.data.user) {
          onUserUpdated(linkResponse.data.user);
        }

        // Create the linked wallet object for local state
        const newWallet: LinkedWallet = {
          address: candidateAddress,
          isPrimary: false, // Secondary wallet
          balance: walletBalance,
          linkedAt: new Date(),
          provider: selectedProvider,
        };

        // Add to internal state
        setInternalLinkedWallets((prev) => [...prev, newWallet]);

        // Notify parent
        if (onWalletLinked) {
          onWalletLinked(newWallet);
        }

        showToast('success', `Secondary wallet ${truncateAddress(candidateAddress)} linked successfully!`);
        
      } else {
        // ========================================
        // PRIMARY WALLET FLOW (First login)
        // No user exists, creating new account
        // ========================================
        
        // Step 4a: Get nonce and message from backend
        const nonceResponse = await getNonce(candidateAddress);
        
        if (!nonceResponse.success || !nonceResponse.data) {
          throw new Error(nonceResponse.error?.message || 'Failed to get authentication nonce');
        }
        
        const { message } = nonceResponse.data;
        
        // Step 4b: Convert message to hex for personal_sign
        const encoder = new TextEncoder();
        const msgBytes = encoder.encode(message);
        const msgHex = '0x' + Array.from(msgBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        
        // Step 4c: Request signature from MetaMask
        const signature = await ethereum.request({
          method: 'personal_sign',
          params: [msgHex, candidateAddress],
        });

        if (!signature) {
          throw new Error('Failed to get signature');
        }

        // Step 5: Send signature to backend for verification
        const linkResponse = await apiLinkWallet(candidateAddress, signature, message);
        
        if (!linkResponse.success || !linkResponse.data) {
          throw new Error(linkResponse.error?.message || 'Failed to verify wallet');
        }

        // Update user state
        if (onUserUpdated && linkResponse.data.user) {
          onUserUpdated(linkResponse.data.user);
        }

        // Create the linked wallet object
        const newWallet: LinkedWallet = {
          address: candidateAddress,
          isPrimary: true, // Primary wallet
          balance: walletBalance,
          linkedAt: new Date(),
          provider: selectedProvider,
        };

        // Add to internal state
        setInternalLinkedWallets((prev) => [...prev, newWallet]);

        // Notify parent
        if (onWalletLinked) {
          onWalletLinked(newWallet);
        }

        // Call legacy onConnect if provided
        if (onConnect) {
          await onConnect('metamask');
        }

        showToast('success', `Wallet ${truncateAddress(candidateAddress)} linked and verified!`);
      }
      
      // Brief delay to show success, then close
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error('Wallet linking error:', {
        error: err,
        message: err?.message,
        code: err?.code,
        stack: err?.stack,
      });
      
      setViewState('confirmation'); // Go back to confirmation on error
      
      if (err.code === 4001) {
        showToast('error', 'Signature rejected. Please sign the message to verify ownership.');
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('Network error')) {
        // Backend is not running - allow blockchain-only mode
        console.warn('Backend API not available. Proceeding with blockchain-only mode.');
        showToast('info', 'Backend offline. Connected in blockchain-only mode.');
        
        // Still notify parent about the connection
        const newWallet: LinkedWallet = {
          address: candidateAddress,
          isPrimary: true,
          balance: walletBalance,
          linkedAt: new Date(),
          provider: selectedProvider,
        };
        
        setInternalLinkedWallets((prev) => [...prev, newWallet]);
        
        if (onWalletLinked) {
          onWalletLinked(newWallet);
        }
        
        if (onConnect) {
          await onConnect('metamask');
        }
        
        setTimeout(() => {
          onClose();
        }, 1500);
        return;
      } else {
        showToast('error', err.message || 'Failed to link wallet.');
      }
    } finally {
      setIsLinking(false);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('info', 'Email login coming soon!');
  };

  if (!isOpen) return null;

  // Merge wallets for display
  const displayWallets = [...internalLinkedWallets];
  linkedWallets.forEach((w) => {
    if (!displayWallets.some((d) => d.address.toLowerCase() === w.address.toLowerCase())) {
      displayWallets.push(w);
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-[60] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-xl shadow-lg border backdrop-blur-sm animate-slide-in flex items-center gap-3 min-w-[300px] ${
              toast.type === 'success'
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : toast.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
            }`}
          >
            {toast.type === 'success' && (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {toast.type === 'info' && (
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#0f0f14] rounded-2xl border border-gray-800/50 w-full max-w-md mx-4 shadow-2xl overflow-hidden">
        
        {/* View 1: Link a Wallet (Connection List) */}
        {viewState === 'list' && (
          <>
            {/* Header */}
            <div className="p-6 pb-4 border-b border-gray-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                    <Icons.Wallet className="w-5 h-5 text-blue-400" />
                  </div>
                  <h2 className="text-xl font-semibold text-white">Link a Wallet</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Icons.Close className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              {!hasEthereum() && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-400 text-sm">
                    MetaMask not detected. Please install MetaMask to connect your wallet.
                  </p>
                </div>
              )}
            </div>

            {/* Wallet List */}
            <div className="p-4 space-y-2">
              {walletProviders.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => handleConnect(provider.id)}
                  disabled={isConnecting !== null}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
                    provider.isConnected
                      ? 'bg-blue-500/10 border border-blue-500/30'
                      : 'bg-[#1a1a24] hover:bg-[#22222e] border border-transparent hover:border-gray-700/50'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {provider.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{provider.name}</span>
                      {provider.isConnected && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                          Connected
                        </span>
                      )}
                    </div>
                    {!provider.isInstalled && provider.id !== 'walletconnect' && (
                      <span className="text-xs text-gray-500">Not installed</span>
                    )}
                  </div>
                  {isConnecting === provider.id ? (
                    <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                  ) : (
                    <Icons.ChevronRight className="w-5 h-5 text-gray-500" />
                  )}
                </button>
              ))}

              {/* More Options Toggle */}
              <button
                onClick={() => setShowMoreOptions(!showMoreOptions)}
                className="w-full flex items-center justify-center gap-2 py-3 text-gray-400 hover:text-white transition-colors"
              >
                <span className="text-sm">{showMoreOptions ? 'Less' : 'More'} wallet options</span>
                <svg 
                  className={`w-4 h-4 transition-transform ${showMoreOptions ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Additional Providers */}
              {showMoreOptions && (
                <div className="space-y-2 pt-2">
                  {additionalProviders.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => handleConnect(provider.id)}
                      disabled={isConnecting !== null}
                      className="w-full flex items-center gap-4 p-4 rounded-xl bg-[#1a1a24] hover:bg-[#22222e] border border-transparent hover:border-gray-700/50 transition-all"
                    >
                      <div className="flex-shrink-0">
                        {provider.icon}
                      </div>
                      <div className="flex-1 text-left">
                        <span className="text-white font-medium">{provider.name}</span>
                        {!provider.isInstalled && (
                          <p className="text-xs text-gray-500">Not installed</p>
                        )}
                      </div>
                      <Icons.ChevronRight className="w-5 h-5 text-gray-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Email Section */}
            <div className="px-4 pb-4">
              <div className="relative flex items-center py-4">
                <div className="flex-1 border-t border-gray-800"></div>
                <span className="px-4 text-sm text-gray-500">or continue with email</span>
                <div className="flex-1 border-t border-gray-800"></div>
              </div>

              <form onSubmit={handleEmailSubmit} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 bg-[#1a1a24] border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  type="submit"
                  className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors"
                >
                  <Icons.ArrowRight className="w-5 h-5" />
                </button>
              </form>
            </div>

            {/* Footer TOS */}
            <div className="px-6 py-4 border-t border-gray-800/50 bg-[#0a0a0f]">
              <p className="text-xs text-gray-500 text-center">
                By connecting a wallet, you agree to our{' '}
                <a href="#" className="text-blue-400 hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-blue-400 hover:underline">Privacy Policy</a>
              </p>
            </div>

            {/* Switch to Management View (if connected) */}
            {connectedAddress && (
              <div className="px-4 pb-4 border-t border-gray-800/50 pt-4">
                <button
                  onClick={() => setViewState('management')}
                  className="w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Icons.Wallet className="w-5 h-5" />
                  Manage Linked Wallets
                </button>
              </div>
            )}
          </>
        )}

        {/* View 2: Linked Wallets (Management) */}
        {viewState === 'management' && (
          <>
            {/* Header */}
            <div className="p-6 pb-4 border-b border-gray-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                    <Icons.Link className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Linked wallets</h2>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Icons.Close className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <p className="text-sm text-gray-400 mt-3">
                Link multiple wallets and set one as your primary. This allows you to manage all your assets from a single account.
              </p>
            </div>

            {/* Active Wallet Card */}
            {displayWallets.length > 0 && (
              <div className="p-4">
                <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl p-5 border border-blue-500/20">
                  <div className="flex items-center gap-4">
                    <WalletAvatar address={displayWallets[0]?.address || connectedAddress || ''} size="lg" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold text-lg font-mono">
                          {truncateAddress(displayWallets[0]?.address || connectedAddress || '')}
                        </span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(displayWallets[0]?.address || connectedAddress || '');
                            showToast('success', 'Address copied!');
                          }}
                          className="p-1 hover:bg-white/10 rounded transition-colors"
                        >
                          <Icons.Copy className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          {displayWallets.length} WALLET{displayWallets.length !== 1 ? 'S' : ''}
                        </span>
                        <span className="text-gray-400 text-sm">{displayWallets[0]?.balance || '$0.00'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Your Linked Wallets List */}
            <div className="px-4 pb-4">
              <h3 className="text-sm font-medium text-gray-400 mb-3 px-1">Your Linked Wallets</h3>
              <div className="space-y-2">
                {displayWallets.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Icons.Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No wallets linked yet</p>
                    <p className="text-sm mt-1">Link a wallet to get started</p>
                  </div>
                ) : (
                  displayWallets.map((wallet, index) => (
                    <div
                      key={wallet.address}
                      className="flex items-center gap-3 p-4 bg-[#1a1a24] rounded-xl border border-gray-800/50 hover:border-gray-700/50 transition-colors"
                    >
                      <WalletAvatar address={wallet.address} size="sm" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium font-mono text-sm">
                            {truncateAddress(wallet.address)}
                          </span>
                          {wallet.isPrimary && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                              <span>⭐</span>
                              PRIMARY
                            </span>
                          )}
                          {connectedAddress?.toLowerCase() === wallet.address.toLowerCase() && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                              ✓ ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{wallet.balance}</span>
                          {wallet.provider && (
                            <>
                              <span>•</span>
                              <span>{wallet.provider}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-4 border-t border-gray-800/50 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-[#1a1a24] hover:bg-[#22222e] text-white font-medium rounded-xl border border-gray-800 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => setViewState('list')}
                className="flex-1 py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Icons.Plus className="w-5 h-5" />
                Link a Wallet
              </button>
            </div>

            {/* Disconnect Option */}
            {displayWallets.length > 0 && (
              <div className="px-4 pb-4">
                <button
                  onClick={() => {
                    setInternalLinkedWallets([]);
                    showToast('info', 'All wallets disconnected');
                    onClose();
                  }}
                  className="w-full py-3 text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                >
                  Disconnect All Wallets
                </button>
              </div>
            )}
          </>
        )}

        {/* View 3: Link Wallet Confirmation */}
        {(viewState === 'confirmation' || viewState === 'signing') && (
          <LinkConfirmationView
            candidateAddress={candidateAddress}
            providerName={selectedProvider}
            balance={walletBalance}
            isLoadingBalance={isLoadingBalance}
            onConfirm={handleSignAndLink}
            onSwitchAccounts={handleSwitchAccounts}
            onBack={() => setViewState('list')}
            isLinking={isLinking}
            isSigning={viewState === 'signing'}
            isSwitchingAccount={isSwitchingAccount}
          />
        )}
      </div>
    </div>
  );
}

// Export a simple trigger button component
export function WalletButton({ 
  address, 
  onClick,
  className = '' 
}: { 
  address?: string; 
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2 bg-[#12121a] hover:bg-[#1a1a24] border border-gray-800 hover:border-gray-700 rounded-xl transition-colors ${className}`}
    >
      {address ? (
        <>
          <WalletAvatar address={address} size="sm" />
          <span className="text-white font-medium font-mono text-sm">
            {truncateAddress(address)}
          </span>
        </>
      ) : (
        <>
          <Icons.Wallet className="w-5 h-5 text-gray-400" />
          <span className="text-white font-medium">Connect Wallet</span>
        </>
      )}
    </button>
  );
}

export default WalletModal;
