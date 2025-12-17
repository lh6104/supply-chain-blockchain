'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getContract } from '@/lib/web3';

export type UserRole = 'ADMIN' | 'RMS' | 'MANUFACTURER' | 'DISTRIBUTOR' | 'RETAILER' | 'GUEST' | 'LOADING';

interface RoleContextType {
  role: UserRole;
  currentAccount: string;
  isLoading: boolean;
  error: string | null;
  refreshRole: () => Promise<void>;
}

const RoleContext = createContext<RoleContextType>({
  role: 'LOADING',
  currentAccount: '',
  isLoading: true,
  error: null,
  refreshRole: async () => {},
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

      // Check if user is the contract owner (ADMIN)
      const owner = await contract.methods.Owner().call();
      if (owner.toLowerCase() === account.toLowerCase()) {
        setRole('ADMIN');
        setIsLoading(false);
        return;
      }

      // Check Manufacturer
      const manCtr = await contract.methods.manCtr().call();
      for (let i = 1; i <= parseInt(manCtr); i++) {
        const man = await contract.methods.MAN(i).call();
        if (man.addr.toLowerCase() === account.toLowerCase()) {
          setRole('MANUFACTURER');
          setIsLoading(false);
          return;
        }
      }

      // Check Distributor
      const disCtr = await contract.methods.disCtr().call();
      for (let i = 1; i <= parseInt(disCtr); i++) {
        const dis = await contract.methods.DIS(i).call();
        if (dis.addr.toLowerCase() === account.toLowerCase()) {
          setRole('DISTRIBUTOR');
          setIsLoading(false);
          return;
        }
      }

      // Check Retailer
      const retCtr = await contract.methods.retCtr().call();
      for (let i = 1; i <= parseInt(retCtr); i++) {
        const ret = await contract.methods.RET(i).call();
        if (ret.addr.toLowerCase() === account.toLowerCase()) {
          setRole('RETAILER');
          setIsLoading(false);
          return;
        }
      }

      // No role found - user is a guest
      setRole('GUEST');
      setIsLoading(false);
    } catch (err: any) {
      console.error('Error fetching role:', err);
      setError(err?.message || 'Failed to fetch role');
      setRole('GUEST');
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

  return (
    <RoleContext.Provider value={{ role, currentAccount, isLoading, error, refreshRole }}>
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

// Helper function to check if user has admin privileges
export function isAdmin(role: UserRole): boolean {
  return role === 'ADMIN';
}

// Helper function to check if user is a supply chain participant
export function isParticipant(role: UserRole): boolean {
  return ['RMS', 'MANUFACTURER', 'DISTRIBUTOR', 'RETAILER'].includes(role);
}

// Helper function to get a human-readable role name
export function getRoleDisplayName(role: UserRole): string {
  switch (role) {
    case 'ADMIN':
      return 'Administrator';
    case 'RMS':
      return 'Raw Material Supplier';
    case 'MANUFACTURER':
      return 'Manufacturer';
    case 'DISTRIBUTOR':
      return 'Distributor';
    case 'RETAILER':
      return 'Retailer';
    case 'GUEST':
      return 'Guest';
    case 'LOADING':
      return 'Loading...';
    default:
      return 'Unknown';
  }
}
