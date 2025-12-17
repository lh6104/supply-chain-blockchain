'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Icons } from './Icons';
import { useRole, getRoleDisplayName, isAdmin, isParticipant, UserRole } from '@/hooks/useRole';
import { WalletModal } from './WalletModal';
import { UserProfileDropdown } from './UserProfileDropdown';
import { useWallet } from '@/contexts/WalletContext';

interface MenuItem {
  icon: typeof Icons.Dashboard;
  label: string;
  path: string;
  roles: UserRole[]; // Which roles can see this item
}

// All menu items with role-based visibility
const allMenuItems: MenuItem[] = [
  { icon: Icons.Dashboard, label: 'Dashboard', path: '/dashboard', roles: ['ADMIN', 'RMS', 'MANUFACTURER', 'DISTRIBUTOR', 'RETAILER', 'GUEST'] },
  { icon: Icons.Participants, label: 'Participants', path: '/roles', roles: ['ADMIN'] },
  { icon: Icons.Products, label: 'Products', path: '/addmed', roles: ['ADMIN'] },
  { icon: Icons.Tasks, label: 'My Tasks', path: '/tasks', roles: ['RMS', 'MANUFACTURER', 'DISTRIBUTOR', 'RETAILER'] },
  { icon: Icons.Track, label: 'Track', path: '/track', roles: ['ADMIN', 'RMS', 'MANUFACTURER', 'DISTRIBUTOR', 'RETAILER', 'GUEST'] },
];

interface SidebarProps {
  currentAccount?: string; // Made optional since we get it from useRole
}

export function Sidebar({ currentAccount: propAccount }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { role, currentAccount: hookAccount, isLoading } = useRole();
  const { currentUser, refreshUser } = useWallet();
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);

  // Use prop account if provided, otherwise use hook account
  const currentAccount = propAccount || hookAccount;

  // Check if running on localhost (dev mode)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      setIsLocalhost(hostname === 'localhost' || hostname === '127.0.0.1');
    }
  }, []);

  // Filter menu items based on role (or show all in dev mode)
  const menuItems = useMemo(() => {
    // DEV MODE: Show all menu items on localhost
    if (isLocalhost) {
      return allMenuItems;
    }
    
    // PRODUCTION: Apply RBAC
    if (isLoading || role === 'LOADING') {
      // Show only dashboard while loading
      return allMenuItems.filter(item => item.path === '/dashboard' || item.path === '/track');
    }
    return allMenuItems.filter(item => item.roles.includes(role));
  }, [role, isLoading, isLocalhost]);

  const handleLogout = async () => {
    // Clear any local storage data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('productImages');
      // Revoke MetaMask permissions (this will require user to reconnect)
      if (window.ethereum && window.ethereum.request) {
        try {
          // Request wallet_revokePermissions to disconnect
          await window.ethereum.request({
            method: 'wallet_revokePermissions',
            params: [{ eth_accounts: {} }]
          });
        } catch (err) {
          // Fallback: some wallets don't support revokePermissions
          console.log('Wallet disconnect not supported, redirecting anyway');
        }
      }
    }
    router.push('/');
    // Force reload to clear any cached state
    window.location.href = '/';
  };

  const shortAddress = currentAccount 
    ? `${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}` 
    : 'Not Connected';

  // Handler to open wallet modal
  const handleOpenWalletModal = () => {
    setIsWalletModalOpen(true);
  };

  // Handler for wallet connection
  const handleWalletConnect = async (providerId: string) => {
    if (providerId === 'metamask' && typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setIsWalletModalOpen(false);
        // Refresh user data from backend
        if (accounts && accounts.length > 0) {
          await refreshUser(accounts[0]);
        }
        // Refresh to update account
        window.location.reload();
      } catch (err) {
        console.error('Failed to connect wallet:', err);
      }
    }
  };

  return (
    <aside className="w-64 bg-[#12121a] min-h-screen flex flex-col fixed left-0 top-0 border-r border-gray-800/50 z-50">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <h1 className="text-white font-bold text-lg">ChainGuard</h1>
          <p className="text-gray-500 text-xs">Supply Chain Manager</p>
        </div>
      </div>

      {/* DEV MODE Badge */}
      {isLocalhost && (
        <div className="mx-4 mb-4 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2">
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
          <span className="text-amber-400 text-xs font-semibold">DEV MODE</span>
          <span className="text-amber-400/60 text-xs ml-auto">All menus</span>
        </div>
      )}

      {/* Menu */}
      <nav className="flex-1 px-4 py-6">
        <ul className="space-y-2">
          {menuItems.map((item, idx) => {
            const isActive = pathname === item.path;
            const IconComponent = item.icon;
            return (
              <li key={idx}>
                <Link
                  href={item.path}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                      : 'text-gray-400 hover:bg-gray-800/50 hover:text-white border border-transparent'
                  }`}
                >
                  <IconComponent className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Profile Trigger Button with Dropdown */}
      <div className="p-4 border-t border-gray-800/50 relative">
        <button 
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-800/30 transition-colors"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center">
            <span className="text-white text-lg">🤖</span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-white font-medium text-sm truncate">{shortAddress}</p>
            <p className="text-gray-500 text-xs">{getRoleDisplayName(role)}</p>
          </div>
          <svg 
            className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        
        {/* User Profile Dropdown - positioned above the trigger */}
        <UserProfileDropdown
          isOpen={isDropdownOpen}
          userProfile={currentUser}
          currentMetaMaskAddress={currentAccount || ''}
          onLinkWallet={() => {
            setIsDropdownOpen(false);
            handleOpenWalletModal();
          }}
          onDisconnect={handleLogout}
          onClose={() => setIsDropdownOpen(false)}
        />
      </div>

      {/* Wallet Connection Modal - Rendered with high z-index */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        connectedAddress={currentAccount}
        onConnect={handleWalletConnect}
      />
    </aside>
  );
}

export default Sidebar;
