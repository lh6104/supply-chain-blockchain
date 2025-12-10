'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getUser, User, LinkedWalletEntry } from '../lib/api';

// Types - aligned with backend
export interface LinkedWallet {
  address: string;
  isPrimary: boolean;
  balance: string;
  linkedAt: Date;
  provider: string;
}

interface WalletContextType {
  // User state (from backend)
  currentUser: User | null;
  isLoadingUser: boolean;
  
  // State
  linkedWallets: LinkedWallet[];
  activeWallet: string | null;
  isConnecting: boolean;
  error: string | null;
  
  // Actions
  addLinkedWallet: (wallet: LinkedWallet) => void;
  removeLinkedWallet: (address: string) => void;
  setActiveWallet: (address: string) => void;
  setPrimaryWallet: (address: string) => void;
  isWalletLinked: (address: string) => boolean;
  clearError: () => void;
  
  // User sync
  setCurrentUser: (user: User | null) => void;
  refreshUser: (walletAddress: string) => Promise<void>;
  syncWalletsFromUser: (user: User) => void;
  
  // Web3 Actions
  connectWallet: () => Promise<string | null>;
  signMessage: (message: string, address: string) => Promise<string | null>;
  getBalance: (address: string) => Promise<string>;
  switchAccount: () => Promise<string | null>;
  disconnectAll: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Local storage key
const STORAGE_KEY = 'chainguard_linked_wallets';
const USER_STORAGE_KEY = 'chainguard_user';

// Helper to check if window.ethereum exists
const hasEthereum = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).ethereum;
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const [linkedWallets, setLinkedWallets] = useState<LinkedWallet[]>([]);
  const [activeWallet, setActiveWalletState] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(false);

  // Sync wallets from user data (internal function) - defined before useEffect
  const syncWalletsFromUserData = useCallback(async (user: User) => {
    if (!user.linkedWallets || user.linkedWallets.length === 0) return;
    
    // Convert backend LinkedWalletEntry to frontend LinkedWallet
    const wallets: LinkedWallet[] = await Promise.all(
      user.linkedWallets.map(async (entry: LinkedWalletEntry) => {
        let balance = '0 ETH';
        
        // Fetch balance if ethereum is available
        if (hasEthereum()) {
          try {
            const ethereum = (window as any).ethereum;
            const balanceHex = await ethereum.request({
              method: 'eth_getBalance',
              params: [entry.address, 'latest'],
            });
            const ethBalance = parseInt(balanceHex, 16) / 1e18;
            balance = ethBalance === 0 ? '0 ETH' : `${ethBalance.toFixed(4)} ETH`;
          } catch (err) {
            console.error('Failed to get balance:', err);
          }
        }
        
        return {
          address: entry.address,
          isPrimary: entry.isPrimary,
          balance,
          linkedAt: new Date(entry.addedAt),
          provider: entry.provider || 'MetaMask',
        };
      })
    );
    
    setLinkedWallets(wallets);
  }, []);

  // Load user from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedUser = localStorage.getItem(USER_STORAGE_KEY);
        if (storedUser) {
          const user = JSON.parse(storedUser) as User;
          setCurrentUserState(user);
          syncWalletsFromUserData(user);
        }
      } catch (err) {
        console.error('Failed to load user:', err);
      }
    }
  }, [syncWalletsFromUserData]);

  // Sync wallets from user (public function)
  const syncWalletsFromUser = useCallback((user: User) => {
    syncWalletsFromUserData(user);
  }, [syncWalletsFromUserData]);

  // Save user to localStorage when changed
  useEffect(() => {
    if (typeof window !== 'undefined' && currentUser) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
    }
  }, [currentUser]);

  // Set current user
  const setCurrentUser = useCallback((user: User | null) => {
    setCurrentUserState(user);
    if (user) {
      syncWalletsFromUserData(user);
    } else {
      setLinkedWallets([]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    }
  }, [syncWalletsFromUserData]);

  // Refresh user from backend
  const refreshUser = useCallback(async (walletAddress: string) => {
    setIsLoadingUser(true);
    try {
      const response = await getUser(walletAddress);
      if (response.success && response.data) {
        setCurrentUser(response.data);
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    } finally {
      setIsLoadingUser(false);
    }
  }, [setCurrentUser]);

  // Listen for account changes in MetaMask
  useEffect(() => {
    if (!hasEthereum()) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setActiveWalletState(null);
      } else {
        setActiveWalletState(accounts[0]);
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    const ethereum = (window as any).ethereum;
    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    // Get initial account
    ethereum.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
      if (accounts.length > 0) {
        setActiveWalletState(accounts[0]);
      }
    });

    return () => {
      ethereum.removeListener('accountsChanged', handleAccountsChanged);
      ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  // Check if wallet is already linked
  const isWalletLinked = useCallback((address: string): boolean => {
    return linkedWallets.some(
      (w) => w.address.toLowerCase() === address.toLowerCase()
    );
  }, [linkedWallets]);

  // Add a linked wallet
  const addLinkedWallet = useCallback((wallet: LinkedWallet) => {
    setLinkedWallets((prev) => {
      // Check if already exists
      if (prev.some((w) => w.address.toLowerCase() === wallet.address.toLowerCase())) {
        return prev;
      }
      // If this is the first wallet, make it primary
      const isFirst = prev.length === 0;
      return [...prev, { ...wallet, isPrimary: isFirst }];
    });
  }, []);

  // Remove a linked wallet
  const removeLinkedWallet = useCallback((address: string) => {
    setLinkedWallets((prev) => {
      const filtered = prev.filter(
        (w) => w.address.toLowerCase() !== address.toLowerCase()
      );
      // If we removed the primary, set a new one
      if (filtered.length > 0 && !filtered.some((w) => w.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    });
  }, []);

  // Set active wallet
  const setActiveWallet = useCallback((address: string) => {
    setActiveWalletState(address);
  }, []);

  // Set primary wallet
  const setPrimaryWallet = useCallback((address: string) => {
    setLinkedWallets((prev) =>
      prev.map((w) => ({
        ...w,
        isPrimary: w.address.toLowerCase() === address.toLowerCase(),
      }))
    );
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Connect wallet using MetaMask
  const connectWallet = useCallback(async (): Promise<string | null> => {
    if (!hasEthereum()) {
      setError('MetaMask is not installed. Please install MetaMask to continue.');
      return null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const ethereum = (window as any).ethereum;
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts && accounts.length > 0) {
        const address = accounts[0];
        setActiveWalletState(address);
        return address;
      }
      
      setError('No accounts found. Please unlock MetaMask.');
      return null;
    } catch (err: any) {
      if (err.code === 4001) {
        setError('Connection rejected. Please approve the connection in MetaMask.');
      } else if (err.code === -32002) {
        setError('Connection request pending. Please check MetaMask.');
      } else {
        setError(err.message || 'Failed to connect wallet.');
      }
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Sign a message for wallet verification
  const signMessage = useCallback(async (message: string, address: string): Promise<string | null> => {
    if (!hasEthereum()) {
      setError('MetaMask is not installed.');
      return null;
    }

    try {
      const ethereum = (window as any).ethereum;
      
      // Convert message to hex (browser-compatible)
      const encoder = new TextEncoder();
      const msgBytes = encoder.encode(message);
      const msgHex = '0x' + Array.from(msgBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      
      const signature = await ethereum.request({
        method: 'personal_sign',
        params: [msgHex, address],
      });
      
      return signature;
    } catch (err: any) {
      if (err.code === 4001) {
        setError('Signature rejected. Please sign the message to verify ownership.');
      } else {
        setError(err.message || 'Failed to sign message.');
      }
      return null;
    }
  }, []);

  // Get wallet balance
  const getBalance = useCallback(async (address: string): Promise<string> => {
    if (!hasEthereum()) return '$0.00';

    try {
      const ethereum = (window as any).ethereum;
      const balance = await ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      });
      
      // Convert from wei to ETH
      const ethBalance = parseInt(balance, 16) / 1e18;
      
      // For demo, just show ETH (in production, you'd convert to USD)
      if (ethBalance === 0) return '$0.00';
      return `${ethBalance.toFixed(4)} ETH`;
    } catch (err) {
      console.error('Failed to get balance:', err);
      return '$0.00';
    }
  }, []);

  // Switch account in MetaMask
  const switchAccount = useCallback(async (): Promise<string | null> => {
    if (!hasEthereum()) {
      setError('MetaMask is not installed.');
      return null;
    }

    try {
      const ethereum = (window as any).ethereum;
      
      // Request permissions to trigger account selection
      await ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });
      
      // Get the newly selected account
      const accounts = await ethereum.request({ method: 'eth_accounts' });
      
      if (accounts && accounts.length > 0) {
        setActiveWalletState(accounts[0]);
        return accounts[0];
      }
      
      return null;
    } catch (err: any) {
      if (err.code === 4001) {
        setError('Account switch cancelled.');
      } else {
        setError(err.message || 'Failed to switch account.');
      }
      return null;
    }
  }, []);

  // Disconnect all wallets
  const disconnectAll = useCallback(() => {
    setLinkedWallets([]);
    setActiveWalletState(null);
    setCurrentUserState(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, []);

  const value: WalletContextType = {
    // User state
    currentUser,
    isLoadingUser,
    
    // Wallet state
    linkedWallets,
    activeWallet,
    isConnecting,
    error,
    
    // Actions
    addLinkedWallet,
    removeLinkedWallet,
    setActiveWallet,
    setPrimaryWallet,
    isWalletLinked,
    clearError,
    
    // User sync
    setCurrentUser,
    refreshUser,
    syncWalletsFromUser,
    
    // Web3 Actions
    connectWallet,
    signMessage,
    getBalance,
    switchAccount,
    disconnectAll,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

export default WalletContext;
