'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { loadWeb3, getContract } from '@/lib/web3';
import { Sidebar } from '../../components/Sidebar';
import { Icons } from '../../components/Icons';
import { useRole } from '@/hooks/useRole';
import { getProductByChainId } from '@/lib/api';

interface Medicine {
  id: string;
  name: string;
  description: string;
  stage: number;
  stageText: string;
  batchNumber?: string;
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
  product: Medicine | null;
  actionLabel: string;
  actionDescription: string;
}

// New stage names matching the updated contract
const stageNames = ["Manufactured", "Packed", "Shipped to Distributor", "Received by Distributor", "Shipped to Retailer", "Received by Retailer", "Sold"];

// Confirmation Modal Component
function ConfirmModal({ isOpen, onClose, onConfirm, isProcessing, product, actionLabel, actionDescription }: ConfirmModalProps) {
  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-[#12121a] rounded-2xl border border-gray-800 p-6 w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
            <Icons.CheckCircle className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Confirm Action</h3>
            <p className="text-sm text-gray-400">{actionDescription}</p>
          </div>
        </div>

        {/* Product Info */}
        <div className="bg-[#0a0a0f] rounded-xl p-4 mb-6 border border-gray-800/50">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Product ID</p>
              <p className="text-white font-medium">#{product.id}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Name</p>
              <p className="text-white font-medium">{product.name}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-500 mb-1">Current Stage</p>
              <p className="text-white font-medium">{product.stageText}</p>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
          <p className="text-sm text-amber-300">
            This action will be recorded on the blockchain and cannot be undone.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 py-3 px-4 rounded-xl border border-gray-700 text-gray-300 font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              actionLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Role-specific action configurations for the new workflow
interface ActionConfig {
  stages: number[]; // Which stages this role can act on
  actions: {
    stage: number;
    key: string;
    label: string;
    description: string;
    nextStage: string;
  }[];
}

const roleActions: Record<string, ActionConfig | null> = {
  'MANUFACTURER': {
    stages: [0, 1],
    actions: [
      { stage: 0, key: 'pack', label: 'Pack Product', description: 'Pack the manufactured product for shipping', nextStage: 'Packed' },
      { stage: 1, key: 'shipToDistributor', label: 'Ship to Distributor', description: 'Ship the packed product to distributor', nextStage: 'Shipped to Distributor' },
    ]
  },
  'DISTRIBUTOR': {
    stages: [2, 3],
    actions: [
      { stage: 2, key: 'receiveFromManufacturer', label: 'Receive Shipment', description: 'Confirm receipt of product from manufacturer', nextStage: 'Received by Distributor' },
      { stage: 3, key: 'shipToRetailer', label: 'Ship to Retailer', description: 'Ship the product to retailer', nextStage: 'Shipped to Retailer' },
    ]
  },
  'RETAILER': {
    stages: [4, 5],
    actions: [
      { stage: 4, key: 'receiveFromDistributor', label: 'Receive Shipment', description: 'Confirm receipt of product from distributor', nextStage: 'Received by Retailer' },
      { stage: 5, key: 'sell', label: 'Mark as Sold', description: 'Record sale to customer', nextStage: 'Sold' },
    ]
  },
  'ADMIN': null,
  'RMS': null,
  'GUEST': null,
  'LOADING': null,
};

export default function TasksPage() {
  const router = useRouter();
  const { role, currentAccount: roleAccount, isLoading: roleLoading } = useRole();
  const [currentAccount, setCurrentAccount] = useState('');
  const [loading, setLoading] = useState(true);
  const [supplyChain, setSupplyChain] = useState<any>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [processing, setProcessing] = useState(false);
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Medicine | null>(null);
  const [selectedAction, setSelectedAction] = useState<{ key: string; label: string; description: string } | null>(null);

  useEffect(() => { loadWeb3(); loadBlockchainData(); }, []);

  useEffect(() => {
    if (roleAccount) {
      setCurrentAccount(roleAccount);
    }
  }, [roleAccount]);

  const loadBlockchainData = async () => {
    try {
      setLoading(true);
      const { contract, account } = await getContract();
      setSupplyChain(contract);
      setCurrentAccount(account);
      
      const medCtr = await contract.methods.medicineCtr().call();
      const medList: Medicine[] = [];
      
      for (let i = 1; i <= parseInt(medCtr); i++) {
        try {
          const med = await contract.methods.MedicineStock(i).call();
          const stageNum = Number(med.stage);
          
          // Fetch off-chain metadata
          let name = `Product #${i}`;
          let description = '';
          let batchNumber = '';
          
          try {
            const apiResponse = await getProductByChainId(i);
            if (apiResponse.success && apiResponse.data) {
              name = apiResponse.data.name || name;
              description = apiResponse.data.description || '';
              batchNumber = apiResponse.data.batchNumber || '';
            }
          } catch {
            // API not available, use defaults
          }
          
          medList.push({
            id: i.toString(),
            name,
            description,
            stage: stageNum,
            stageText: stageNames[stageNum] || 'Unknown',
            batchNumber,
          });
        } catch (err) {
          console.warn(`Error loading medicine ${i}:`, err);
        }
      }
      
      setMedicines(medList);
      setLoading(false);
    } catch (err: any) {
      console.error('Error loading blockchain data:', err);
      setLoading(false);
    }
  };

  // Filter medicines based on user role
  const filteredMedicines = useMemo(() => {
    const config = roleActions[role];
    if (!config) return [];

    // Show products at stages this role can act on
    return medicines.filter(m => config.stages.includes(m.stage));
  }, [medicines, role]);

  const getActionForProduct = (product: Medicine): { key: string; label: string; description: string } | null => {
    const config = roleActions[role];
    if (!config) return null;

    const action = config.actions.find(a => a.stage === product.stage);
    if (!action) return null;
    
    return { key: action.key, label: action.label, description: action.description };
  };

  const openConfirmModal = (product: Medicine) => {
    const action = getActionForProduct(product);
    if (!action) return;
    
    setSelectedProduct(product);
    setSelectedAction(action);
    setModalOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedProduct || !selectedAction || !supplyChain) return;
    
    setProcessing(true);
    try {
      const id = parseInt(selectedProduct.id);
      let receipt;
      
      // Map action keys to contract methods
      switch (selectedAction.key) {
        case 'pack':
          receipt = await supplyChain.methods.packMedicine(id).send({ from: currentAccount });
          break;
        case 'shipToDistributor':
          receipt = await supplyChain.methods.shipToDistributor(id).send({ from: currentAccount });
          break;
        case 'receiveFromManufacturer':
          receipt = await supplyChain.methods.receiveByDistributor(id).send({ from: currentAccount });
          break;
        case 'shipToRetailer':
          receipt = await supplyChain.methods.shipToRetailer(id).send({ from: currentAccount });
          break;
        case 'receiveFromDistributor':
          receipt = await supplyChain.methods.receiveByRetailer(id).send({ from: currentAccount });
          break;
        case 'sell':
          receipt = await supplyChain.methods.sellMedicine(id).send({ from: currentAccount });
          break;
      }
      
      if (receipt) {
        setModalOpen(false);
        setSelectedProduct(null);
        setSelectedAction(null);
        await loadBlockchainData();
      }
    } catch (err: any) {
      console.error('Transaction error:', err);
      const errorMessage = err?.message?.includes('Only')
        ? 'You do not have permission for this action'
        : err?.message?.includes('User denied')
        ? 'Transaction was cancelled'
        : err?.message || 'Transaction failed';
      alert(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const getStageColor = (stage: number) => {
    const colors = [
      'bg-blue-500/20 text-blue-400',      // Manufactured
      'bg-cyan-500/20 text-cyan-400',      // Packed
      'bg-orange-500/20 text-orange-400',  // ShippedToDistributor
      'bg-yellow-500/20 text-yellow-400',  // ReceivedByDistributor
      'bg-purple-500/20 text-purple-400',  // ShippedToRetailer
      'bg-pink-500/20 text-pink-400',      // ReceivedByRetailer
      'bg-green-500/20 text-green-400',    // Sold
    ];
    return colors[stage] || 'bg-gray-500/20 text-gray-400';
  };

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading Tasks...</p>
        </div>
      </div>
    );
  }

  // Show access denied for admin and guests
  if (role === 'ADMIN' || role === 'GUEST') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex">
        <Sidebar />
        <div className="flex-1 ml-64 p-8">
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Icons.Shield className="w-10 h-10 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">
                {role === 'ADMIN' ? 'Owner View' : 'Access Restricted'}
              </h2>
              <p className="text-gray-400 mb-6">
                {role === 'ADMIN' 
                  ? 'As the contract owner, you manage participants but do not perform supply chain tasks. Manufacturers, Distributors, and Retailers handle product workflow.'
                  : 'You need to be registered as a supply chain participant (Manufacturer, Distributor, or Retailer) to access tasks. Contact the Owner to register your wallet address.'}
              </p>
              <div className="flex gap-3 justify-center">
                {role === 'ADMIN' && (
                  <button
                    onClick={() => router.push('/roles')}
                    className="px-6 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors"
                  >
                    Manage Participants
                  </button>
                )}
                <button
                  onClick={() => router.push('/track')}
                  className="px-6 py-3 bg-gray-800 text-white rounded-xl font-semibold hover:bg-gray-700 transition-colors"
                >
                  Track Products
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getRoleInstructions = () => {
    switch (role) {
      case 'MANUFACTURER':
        return 'Pack manufactured products and ship them to distributors.';
      case 'DISTRIBUTOR':
        return 'Receive shipments from manufacturers and forward to retailers.';
      case 'RETAILER':
        return 'Receive products from distributors and mark them as sold.';
      default:
        return 'View your pending supply chain tasks.';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">My Tasks</h1>
              <p className="text-gray-400">{getRoleInstructions()}</p>
            </div>
            <button
              onClick={loadBlockchainData}
              className="px-4 py-2 bg-[#12121a] border border-gray-800 rounded-xl text-gray-300 hover:text-white hover:border-gray-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#12121a] rounded-xl p-4 border border-gray-800/50">
            <div className="text-2xl font-bold text-white">{filteredMedicines.length}</div>
            <div className="text-sm text-gray-400">Pending Tasks</div>
          </div>
          <div className="bg-[#12121a] rounded-xl p-4 border border-gray-800/50">
            <div className="text-2xl font-bold text-blue-400">{role}</div>
            <div className="text-sm text-gray-400">Your Role</div>
          </div>
          <div className="bg-[#12121a] rounded-xl p-4 border border-gray-800/50">
            <div className="text-2xl font-bold text-green-400">{medicines.length}</div>
            <div className="text-sm text-gray-400">Total Products</div>
          </div>
        </div>

        {/* Role-Specific Workflow Guide */}
        <div className="bg-[#12121a] rounded-xl p-4 border border-gray-800/50 mb-8">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Icons.Track className="w-5 h-5 text-blue-400" />
            Your Workflow
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {roleActions[role]?.actions.map((action, idx) => (
              <div key={action.key} className="flex items-center gap-2">
                <div className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  idx === 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {action.label}
                </div>
                {idx < (roleActions[role]?.actions.length || 0) - 1 && (
                  <span className="text-gray-600">→</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-[#12121a] rounded-2xl border border-gray-800/50 overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-gray-800/50">
            <h2 className="text-lg font-semibold text-white">Pending Actions</h2>
          </div>

          {filteredMedicines.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800/50">
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Batch</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Current Stage</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {filteredMedicines.map((product) => {
                    const action = getActionForProduct(product);
                    return (
                      <tr key={product.id} className="hover:bg-gray-800/20 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-white font-medium">#{product.id}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <span className="text-white">{product.name}</span>
                            {product.description && (
                              <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{product.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-gray-400 text-sm">{product.batchNumber || '-'}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStageColor(product.stage)}`}>
                            {product.stageText}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {action ? (
                            <button
                              onClick={() => openConfirmModal(product)}
                              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                            >
                              {action.label}
                            </button>
                          ) : (
                            <button
                              onClick={() => router.push(`/track?id=${product.id}`)}
                              className="px-4 py-2 bg-gray-800 text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                            >
                              View Details
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-16 text-center">
              <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icons.CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">All Caught Up!</h3>
              <p className="text-gray-400">
                There are no products waiting for your action.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={modalOpen}
        onClose={() => {
          if (!processing) {
            setModalOpen(false);
            setSelectedProduct(null);
            setSelectedAction(null);
          }
        }}
        onConfirm={handleConfirmAction}
        isProcessing={processing}
        product={selectedProduct}
        actionLabel={selectedAction?.label || ''}
        actionDescription={selectedAction?.description || ''}
      />
    </div>
  );
}
