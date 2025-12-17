'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadWeb3, getContract } from '@/lib/web3';
import { Icons } from '../../components/Icons';
import { useRole } from '../../hooks/useRole';

interface Role {
  addr: string;
  id: string;
  name: string;
  place: string;
}

// Toast notification component
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border ${
      type === 'success' 
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
        : 'bg-red-500/10 border-red-500/30 text-red-400'
    }`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
        type === 'success' ? 'bg-emerald-500/20' : 'bg-red-500/20'
      }`}>
        {type === 'success' ? (
          <Icons.CheckCircle className="w-5 h-5" />
        ) : (
          <Icons.Error className="w-5 h-5" />
        )}
      </div>
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 p-1 hover:bg-white/10 rounded-lg transition-colors">
        <Icons.Close className="w-4 h-4" />
      </button>
    </div>
  );
}

// Ethereum address validation
function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export default function Participants() {
  const router = useRouter();
  const { role } = useRole();
  const [currentAccount, setCurrentAccount] = useState('');
  const [loading, setLoading] = useState(true);
  const [supplyChain, setSupplyChain] = useState<any>(null);
  const [contractOwner, setContractOwner] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'man' | 'dis' | 'ret'>('man');
  const [roles, setRoles] = useState<{ man: Role[]; dis: Role[]; ret: Role[] }>({ man: [], dis: [], ret: [] });
  const [newRole, setNewRole] = useState({ address: '', name: '', place: '', type: 'man' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addressError, setAddressError] = useState('');
  
  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => { 
    loadWeb3(); 
    loadBlockchainData(); 
  }, []);

  const loadBlockchainData = async () => {
    try {
      setLoading(true);
      const { contract, account } = await getContract();
      setSupplyChain(contract);
      setCurrentAccount(account);
      
      // Fetch counts
      const manCount = await contract.methods.manCtr().call();
      const disCount = await contract.methods.disCtr().call();
      const retCount = await contract.methods.retCtr().call();
      
      // Fetch all participants by looping through IDs
      const man = await Promise.all(
        Array(parseInt(manCount)).fill(null).map((_, i) => contract.methods.MAN(i + 1).call())
      );
      const dis = await Promise.all(
        Array(parseInt(disCount)).fill(null).map((_, i) => contract.methods.DIS(i + 1).call())
      );
      const ret = await Promise.all(
        Array(parseInt(retCount)).fill(null).map((_, i) => contract.methods.RET(i + 1).call())
      );
      
      setRoles({ man, dis, ret });
      
      const owner = await contract.methods.Owner().call();
      if (owner) setContractOwner(owner);
      
      setLoading(false);
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to load blockchain data', type: 'error' });
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewRole(prev => ({ ...prev, [name]: value }));
    
    // Validate address in real-time
    if (name === 'address') {
      if (value && !isValidEthereumAddress(value)) {
        setAddressError('Invalid Ethereum address format');
      } else {
        setAddressError('');
      }
    }
  };

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate address before submission
    if (!isValidEthereumAddress(newRole.address)) {
      setAddressError('Please enter a valid Ethereum address (0x... with 40 hex characters)');
      return;
    }
    
    setIsSubmitting(true);
    try {
      let receipt;
      
      // Call the appropriate smart contract function based on role type
      switch (newRole.type) {
        case 'man':
          receipt = await supplyChain.methods
            .addManufacturer(newRole.address)
            .send({ from: currentAccount });
          break;
        case 'dis':
          receipt = await supplyChain.methods
            .addDistributor(newRole.address)
            .send({ from: currentAccount });
          break;
        case 'ret':
          receipt = await supplyChain.methods
            .addRetailer(newRole.address)
            .send({ from: currentAccount });
          break;
      }
      
      if (receipt) {
        setToast({ message: `${roleConfig[newRole.type as keyof typeof roleConfig].label} registered successfully!`, type: 'success' });
        loadBlockchainData();
        setNewRole({ address: '', name: '', place: '', type: newRole.type });
        setActiveTab(newRole.type as 'man' | 'dis' | 'ret');
      }
    } catch (err: any) {
      const errorMessage = err?.message?.includes('Only owner') 
        ? 'Only the contract owner can register participants'
        : err?.message || 'Transaction failed';
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleConfig = {
    man: { 
      label: 'Manufacturer', 
      plural: 'Manufacturers', 
      shortLabel: 'MAN',
      icon: <Icons.Manufacture className="w-5 h-5" />, 
      color: 'from-blue-500 to-cyan-500', 
      bgLight: 'bg-blue-500/10', 
      textColor: 'text-blue-400',
      badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      description: 'Creates pharmaceutical products and ships to distributors'
    },
    dis: { 
      label: 'Distributor', 
      plural: 'Distributors', 
      shortLabel: 'DIS',
      icon: <Icons.Distribution className="w-5 h-5" />, 
      color: 'from-purple-500 to-pink-500', 
      bgLight: 'bg-purple-500/10', 
      textColor: 'text-purple-400',
      badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      description: 'Receives products from manufacturers and ships to retailers'
    },
    ret: { 
      label: 'Retailer', 
      plural: 'Retailers', 
      shortLabel: 'RET',
      icon: <Icons.Retail className="w-5 h-5" />, 
      color: 'from-emerald-500 to-green-500', 
      bgLight: 'bg-emerald-500/10', 
      textColor: 'text-emerald-400',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      description: 'Receives products from distributors and sells to customers'
    },
  };

  // Get total participant count
  const totalParticipants = roles.man.length + roles.dis.length + roles.ret.length;

  if (loading || role === 'LOADING') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading Participants...</p>
        </div>
      </div>
    );
  }

  const canRegister = role === 'ADMIN';

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="p-8">
        {/* Back Button */}
        <button
          onClick={() => router.push('/dashboard')}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700 rounded-xl transition-colors"
        >
          <Icons.ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Participants Management</h1>
            <p className="text-gray-400">Register and manage supply chain stakeholders</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{totalParticipants}</div>
            <div className="text-sm text-gray-400">Total Registered</div>
          </div>
        </div>

        {/* Owner Warning */}
        {!canRegister && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex gap-3 items-start">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <Icons.Warning className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-400">Owner Access Required</h3>
                <p className="text-sm text-amber-300/70">Only the contract owner can register participants.</p>
                <p className="text-xs font-mono text-amber-400/50 mt-1">Owner: {contractOwner}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {(['man', 'dis', 'ret'] as const).map(key => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`p-5 rounded-2xl border transition-all duration-300 text-left ${
                activeTab === key 
                  ? 'bg-[#16161f] border-blue-500/50 shadow-lg shadow-blue-500/10' 
                  : 'bg-[#12121a] border-gray-800/50 hover:border-gray-700/50'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${roleConfig[key].color} flex items-center justify-center text-white mb-3`}>
                {roleConfig[key].icon}
              </div>
              <p className="text-3xl font-bold text-white">{roles[key].length}</p>
              <p className="text-sm text-gray-400">{roleConfig[key].plural}</p>
              <p className="text-xs text-gray-500 mt-1">{roleConfig[key].description}</p>
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Registration Form */}
          <div className="lg:col-span-1">
            <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50">
              <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Icons.UserPlus className="w-5 h-5 text-blue-400" />
                </div>
                Register New Participant
              </h2>
              
              <form onSubmit={handleRoleSubmit} className="space-y-4">
                {/* Role Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Role Type</label>
                  <select
                    className="w-full px-4 py-3 bg-[#0a0a0f] border border-gray-800 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors"
                    name="type"
                    onChange={handleInputChange}
                    value={newRole.type}
                  >
                    <option value="man">🏭 Manufacturer</option>
                    <option value="dis">🚚 Distributor</option>
                    <option value="ret">🏪 Retailer</option>
                  </select>
                </div>
                
                {/* Wallet Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Wallet Address</label>
                  <input
                    className={`w-full px-4 py-3 bg-[#0a0a0f] border rounded-xl text-white font-mono text-sm placeholder-gray-600 focus:outline-none transition-colors ${
                      addressError ? 'border-red-500' : 'border-gray-800 focus:border-blue-500'
                    }`}
                    name="address"
                    placeholder="0x..."
                    onChange={handleInputChange}
                    value={newRole.address}
                    required
                  />
                  {addressError && (
                    <p className="text-red-400 text-xs mt-1">{addressError}</p>
                  )}
                </div>
                
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Name</label>
                  <input
                    className="w-full px-4 py-3 bg-[#0a0a0f] border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                    name="name"
                    placeholder="Company or person name"
                    onChange={handleInputChange}
                    value={newRole.name}
                    required
                  />
                </div>
                
                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Location</label>
                  <input
                    className="w-full px-4 py-3 bg-[#0a0a0f] border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                    name="place"
                    placeholder="City, Country"
                    onChange={handleInputChange}
                    value={newRole.place}
                    required
                  />
                </div>
                
                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!canRegister || isSubmitting || !!addressError}
                  className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                    canRegister && !isSubmitting && !addressError
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700' 
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Registering...
                    </>
                  ) : canRegister ? (
                    <>
                      <Icons.Plus className="w-5 h-5" />
                      Register Participant
                    </>
                  ) : (
                    <>
                      <Icons.Error className="w-4 h-4" />
                      Owner Only
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Participants Data Table */}
          <div className="lg:col-span-2">
            <div className="bg-[#12121a] rounded-2xl border border-gray-800/50 overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-gray-800">
                {(['man', 'dis', 'ret'] as const).map(key => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex-1 px-4 py-4 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      activeTab === key 
                        ? 'text-white border-b-2 border-blue-500 bg-blue-500/5' 
                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
                    }`}
                  >
                    {roleConfig[key].icon}
                    <span className="hidden md:inline">{roleConfig[key].plural}</span>
                    <span className="md:hidden">{roleConfig[key].shortLabel}</span>
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                      activeTab === key ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-500'
                    }`}>
                      {roles[key].length}
                    </span>
                  </button>
                ))}
              </div>

              {/* Table Header */}
              <div className="px-6 py-4 border-b border-gray-800/50 bg-[#0a0a0f]/50">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  {roleConfig[activeTab].icon}
                  Registered {roleConfig[activeTab].plural}
                </h3>
              </div>

              {/* Table Content */}
              <div className="p-6">
                {roles[activeTab].length === 0 ? (
                  <div className="text-center py-12">
                    <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${roleConfig[activeTab].color} flex items-center justify-center text-white mb-4`}>
                      {roleConfig[activeTab].icon}
                    </div>
                    <p className="text-gray-400">No {roleConfig[activeTab].plural.toLowerCase()} registered yet</p>
                    {canRegister && (
                      <p className="text-gray-500 text-sm mt-2">Use the form to register your first one</p>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                          <th className="pb-3 font-medium">Role</th>
                          <th className="pb-3 font-medium">Wallet Address</th>
                          <th className="pb-3 font-medium">Name</th>
                          <th className="pb-3 font-medium">Location</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/50">
                        {roles[activeTab].map((roleData, i) => {
                          const isCurrentUser = roleData.addr?.toLowerCase() === currentAccount?.toLowerCase();
                          const isOwnerAddress = roleData.addr?.toLowerCase() === contractOwner?.toLowerCase();
                          
                          return (
                            <tr key={i} className={`hover:bg-gray-800/20 transition-colors ${isCurrentUser ? 'bg-blue-500/5' : ''}`}>
                              <td className="py-4">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${roleConfig[activeTab].badgeColor}`}>
                                    {roleConfig[activeTab].icon}
                                    {roleConfig[activeTab].shortLabel}
                                  </span>
                                  {isOwnerAddress && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                      👑 OWNER
                                    </span>
                                  )}
                                  {isCurrentUser && !isOwnerAddress && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                                      YOU
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-4">
                                <span className="font-mono text-sm text-gray-400">
                                  {roleData.addr?.slice(0, 8)}...{roleData.addr?.slice(-6)}
                                </span>
                              </td>
                              <td className="py-4">
                                <span className="text-white font-medium">{roleData.name}</span>
                              </td>
                              <td className="py-4">
                                <span className="text-gray-400 flex items-center gap-1">
                                  <Icons.Location className="w-4 h-4" />
                                  {roleData.place}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Supply Chain Flow Info */}
        <div className="mt-6 bg-[#12121a] rounded-xl p-6 border border-gray-800/50">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Icons.Track className="w-5 h-5 text-blue-400" />
            Supply Chain Flow
          </h3>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 text-center p-4 bg-blue-500/10 rounded-xl border border-blue-500/30">
              <Icons.Manufacture className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <p className="text-blue-400 font-medium">Manufacturer</p>
              <p className="text-gray-500 text-xs">Creates products</p>
            </div>
            <div className="text-gray-600">→</div>
            <div className="flex-1 text-center p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
              <Icons.Distribution className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <p className="text-purple-400 font-medium">Distributor</p>
              <p className="text-gray-500 text-xs">Logistics & warehousing</p>
            </div>
            <div className="text-gray-600">→</div>
            <div className="flex-1 text-center p-4 bg-green-500/10 rounded-xl border border-green-500/30">
              <Icons.Retail className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-green-400 font-medium">Retailer</p>
              <p className="text-gray-500 text-xs">Sells to customers</p>
            </div>
          </div>
        </div>

        {/* Owner Info Card */}
        <div className="mt-6 bg-[#12121a] rounded-xl p-4 border border-gray-800/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
              <span className="text-2xl">👑</span>
            </div>
            <div>
              <h3 className="text-white font-semibold">Contract Owner</h3>
              <p className="text-gray-500 font-mono text-sm">{contractOwner}</p>
            </div>
            {canRegister && (
              <span className="ml-auto px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-medium border border-purple-500/30">
                This is you
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
