'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getContract } from '@/lib/web3';

// Updated roles - removed RMS and GUEST as per new workflow
export type UserRole = 'OWNER' | 'MANUFACTURER' | 'DISTRIBUTOR' | 'RETAILER' | 'UNREGISTERED' | 'LOADING';

interface RoleContextType {
  role: UserRole;
  currentAccount: string;
  isLoading: boolean;
  error: string | null;
  refreshRole: () => Promise<void>;
  // Helper methods
  isOwner: () => boolean;
  isManufacturer: () => boolean;
  isDistributor: () => boolean;
  isRetailer: () => boolean;
  isParticipant: () => boolean;
  getRoleDisplayName: () => string;
}

const RoleContext = createContext<RoleContextType>({
  role: 'LOADING',
  currentAccount: '',
  isLoading: true,
  error: null,
  refreshRole: async () => {},
  isOwner: () => false,
  isManufacturer: () => false,
  isDistributor: () => false,
  isRetailer: () => false,
  isParticipant: () => false,
  getRoleDisplayName: () => 'Loading...',
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>('LOADING');
  const [currentAccount, setCurrentAccount] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRole = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { contract, account } = await getContract();
      setCurrentAccount(account);

      // First check if this is the owner (most reliable method)
      const contractOwner = await contract.methods.Owner().call();
      if (account.toLowerCase() === contractOwner.toLowerCase()) {
        setRole('OWNER');
        setIsLoading(false);
        return;
      }
      
      // Use the getRole function for other roles
      const roleStr = await contract.methods.getRole(account).call();
      console.log('Role from contract:', roleStr, 'for account:', account);
      
      switch (roleStr) {
        case 'Owner':
          setRole('OWNER');
          break;
        case 'Manufacturer':
          setRole('MANUFACTURER');
          break;
        case 'Distributor':
          setRole('DISTRIBUTOR');
          break;
        case 'Retailer':
          setRole('RETAILER');
          break;
        default:
          setRole('UNREGISTERED');
      }
      
      setIsLoading(false);
    } catch (err: any) {
      console.error('Error fetching role:', err);
      setError(err?.message || 'Failed to fetch role');
      setRole('UNREGISTERED');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRole();

    // Listen for account changes
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountsChanged = () => {
        fetchRole();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, [fetchRole]);

  const refreshRole = async () => {
    await fetchRole();
  };

  // Helper methods
  const isOwner = useCallback(() => role === 'OWNER', [role]);
  const isManufacturer = useCallback(() => role === 'MANUFACTURER', [role]);
  const isDistributor = useCallback(() => role === 'DISTRIBUTOR', [role]);
  const isRetailer = useCallback(() => role === 'RETAILER', [role]);
  const isParticipant = useCallback(() => ['MANUFACTURER', 'DISTRIBUTOR', 'RETAILER'].includes(role), [role]);
  
  const getRoleDisplayName = useCallback(() => {
    switch (role) {
      case 'OWNER':
        return 'Owner';
      case 'MANUFACTURER':
        return 'Manufacturer';
      case 'DISTRIBUTOR':
        return 'Distributor';
      case 'RETAILER':
        return 'Retailer';
      case 'UNREGISTERED':
        return 'Unregistered';
      case 'LOADING':
        return 'Loading...';
      default:
        return 'Unknown';
    }
  }, [role]);

  return (
    <RoleContext.Provider value={{ 
      role, 
      currentAccount, 
      isLoading, 
      error, 
      refreshRole,
      isOwner,
      isManufacturer,
      isDistributor,
      isRetailer,
      isParticipant,
      getRoleDisplayName,
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}

// Standalone helper functions for external use
export function isOwnerRole(role: UserRole): boolean {
  return role === 'OWNER';
}

export function isParticipantRole(role: UserRole): boolean {
  return ['MANUFACTURER', 'DISTRIBUTOR', 'RETAILER'].includes(role);
}

export function getRoleDisplayNameStatic(role: UserRole): string {
  switch (role) {
    case 'OWNER':
      return 'Owner';
    case 'MANUFACTURER':
      return 'Manufacturer';
    case 'DISTRIBUTOR':
      return 'Distributor';
    case 'RETAILER':
      return 'Retailer';
    case 'UNREGISTERED':
      return 'Unregistered';
    case 'LOADING':
      return 'Loading...';
    default:
      return 'Unknown';
  }
}
