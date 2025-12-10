'use client';
import { useRef, useEffect, useState } from 'react';
import { User, LinkedWalletEntry } from '../lib/api';

// Types
interface UserProfileDropdownProps {
  isOpen: boolean;
  userProfile: User | null;           // Full user profile from backend
  currentMetaMaskAddress: string;     // Currently connected MetaMask wallet
  balance?: string;
  onLinkWallet: () => void;
  onDisconnect: () => void;
  onClose?: () => void;
  onProfile?: () => void;
  onSwitchWallet?: (address: string) => void;  // Optional: switch to a different wallet
}

// Lucide-style icons (inline SVGs)
const Icons = {
  Star: ({ className = "w-4 h-4", filled = false }: { className?: string; filled?: boolean }) => (
    <svg className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  Check: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  Plus: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  ),
  User: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  LogOut: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  Copy: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  Wallet: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  GreenDot: ({ className = "w-2 h-2" }: { className?: string }) => (
    <span className={`${className} inline-block rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]`} />
  ),
};

// Avatar component with gradient based on address
function WalletAvatar({ address, size = 'md', dimmed = false }: { address: string; size?: 'sm' | 'md' | 'lg'; dimmed?: boolean }) {
  const gradients = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-orange-500 to-red-500',
    'from-pink-500 to-rose-500',
  ];
  const colorIndex = parseInt(address.slice(-2), 16) % gradients.length;
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
  };

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${gradients[colorIndex]} flex items-center justify-center flex-shrink-0 ${dimmed ? 'opacity-50' : ''}`}>
      <span className="text-white">🤖</span>
    </div>
  );
}

// Truncate address helper
function truncateAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function UserProfileDropdown({
  isOpen,
  userProfile,
  currentMetaMaskAddress,
  balance = '0 ETH',
  onLinkWallet,
  onDisconnect,
  onClose,
  onProfile,
  onSwitchWallet,
}: UserProfileDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose?.();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Copy address to clipboard
  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  if (!isOpen) return null;

  // Get linked wallets from userProfile, or fallback to current address
  const linkedWallets: LinkedWalletEntry[] = userProfile?.linkedWallets || [
    { address: currentMetaMaskAddress, isPrimary: true, addedAt: new Date().toISOString() }
  ];
  
  const primaryWallet = userProfile?.primaryWallet || currentMetaMaskAddress;
  const walletCount = linkedWallets.length;
  const userName = userProfile?.profile?.name || 'Anonymous';

  // Check if a wallet is the currently active MetaMask wallet
  const isActiveWallet = (walletAddress: string) => 
    walletAddress.toLowerCase() === currentMetaMaskAddress.toLowerCase();

  // Check if a wallet is the primary wallet
  const isPrimaryWallet = (walletAddress: string) => 
    walletAddress.toLowerCase() === primaryWallet.toLowerCase();

  return (
    <div
      ref={dropdownRef}
      className="absolute left-0 bottom-full mb-2 w-80 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50"
    >
      {/* Top Section - User Summary */}
      <div className="p-4 border-b border-gray-800 bg-gradient-to-br from-gray-900 to-gray-800/50">
        <div className="flex items-center gap-3">
          <WalletAvatar address={primaryWallet} size="lg" />
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-base truncate">
              {userName}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-400 font-mono">
                {truncateAddress(primaryWallet)}
              </span>
              <button
                onClick={() => handleCopyAddress(primaryWallet)}
                className="p-0.5 hover:bg-gray-700 rounded transition-colors"
                title="Copy address"
              >
                {copiedAddress === primaryWallet ? (
                  <Icons.Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Icons.Copy className="w-3 h-3 text-gray-500 hover:text-gray-300" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {walletCount} WALLET{walletCount !== 1 ? 'S' : ''}
              </span>
              {userProfile?.role && userProfile.role !== 'unregistered' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 uppercase">
                  {userProfile.role}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section - Linked Wallets List */}
      <div className="p-2">
        <div className="text-xs text-gray-500 font-medium px-2 py-1.5 uppercase tracking-wider">
          Linked Wallets
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
          {linkedWallets.map((wallet) => {
            const isPrimary = isPrimaryWallet(wallet.address);
            const isActive = isActiveWallet(wallet.address);
            const isDimmed = !isActive;

            return (
              <div
                key={wallet.address}
                className={`p-3 rounded-lg transition-colors cursor-default ${
                  isActive 
                    ? 'bg-gray-800/80 border border-gray-700/50' 
                    : 'bg-gray-800/30 hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <WalletAvatar address={wallet.address} size="sm" dimmed={isDimmed} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-sm font-medium font-mono ${isDimmed ? 'text-gray-400' : 'text-white'}`}>
                        {truncateAddress(wallet.address)}
                      </span>
                      
                      {/* Primary Wallet Star Icon */}
                      {isPrimary && (
                        <span 
                          title="Primary Wallet" 
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                        >
                          <Icons.Star className="w-3 h-3" filled />
                          <span className="hidden sm:inline">Primary</span>
                        </span>
                      )}
                      
                      {/* Active Session Green Dot */}
                      {isActive && (
                        <span 
                          title="Currently Connected" 
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        >
                          <Icons.GreenDot className="w-1.5 h-1.5" />
                          <span>Active</span>
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs ${isDimmed ? 'text-gray-600' : 'text-gray-500'}`}>
                        {wallet.provider || 'MetaMask'}
                      </span>
                      {isActive && (
                        <>
                          <span className="text-gray-600">•</span>
                          <span className="text-xs text-gray-500">{balance}</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Copy button */}
                  <button
                    onClick={() => handleCopyAddress(wallet.address)}
                    className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                    title="Copy address"
                  >
                    {copiedAddress === wallet.address ? (
                      <Icons.Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Icons.Copy className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-800 mx-2" />

      {/* Bottom Section - Actions */}
      <div className="p-2 space-y-1">
        {/* Link Wallet - Primary Action */}
        <button
          onClick={onLinkWallet}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-800 transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
            <Icons.Plus className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-sm text-gray-300 group-hover:text-white transition-colors font-medium">
            Link New Wallet
          </span>
        </button>

        {/* Profile */}
        <button
          onClick={onProfile}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-800 transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center group-hover:bg-gray-700 transition-colors">
            <Icons.User className="w-4 h-4 text-gray-400" />
          </div>
          <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
            Profile
          </span>
        </button>

        {/* Logout */}
        <button
          onClick={onDisconnect}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-800 transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
            <Icons.LogOut className="w-4 h-4 text-red-400" />
          </div>
          <span className="text-sm text-red-400 group-hover:text-red-300 transition-colors">
            Logout
          </span>
        </button>
      </div>
    </div>
  );
}

// Export a trigger button component for easy integration
export function ProfileTriggerButton({
  address,
  onClick,
  isOpen,
  className = '',
}: {
  address: string;
  onClick: () => void;
  isOpen?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 transition-all ${
        isOpen ? 'ring-2 ring-blue-500/50' : ''
      } ${className}`}
    >
      <WalletAvatar address={address} size="sm" />
      <span className="text-white text-sm font-mono">{truncateAddress(address)}</span>
      <svg
        className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

export default UserProfileDropdown;
