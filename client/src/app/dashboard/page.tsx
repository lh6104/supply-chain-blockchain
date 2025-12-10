'use client';
import { useEffect, useState, useCallback } from "react";
import Web3 from "web3";
import SupplyChainABI from "../../artifacts/contracts/SupplyChain.sol/SupplyChain.json";
import { useRouter } from 'next/navigation';
import { Sidebar } from "../../components/Sidebar";
import { Icons } from "../../components/Icons";
import deployments from "../../deployments.json";
import { getProductsBatch, healthCheck } from "../../lib/api";
import { useRole } from "../../hooks/useRole";

const getContractAddress = (): string => {
  const network1337 = deployments.networks["1337"];
  if (network1337?.SupplyChain?.address) {
    return network1337.SupplyChain.address;
  }
  return "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
};

interface Medicine {
  id: number;
  name: string;
  description: string;
  stage: number;
  hasMetadata?: boolean;
  batchNumber?: string;
  manufacturer?: string;
}

interface Counts {
  manufacturers: number;
  distributors: number;
  retailers: number;
  medicines: number;
}

interface ApiStatus {
  connected: boolean;
  message: string;
}

// New stage names matching the updated contract
const stageNames = ["Manufactured", "Packed", "Shipped to Distributor", "Received by Distributor", "Shipped to Retailer", "Received by Retailer", "Sold"];

export default function Dashboard() {
  const router = useRouter();
  const { role, isOwner, isManufacturer, isDistributor, isRetailer, getRoleDisplayName } = useRole();
  const [currentAccount, setCurrentAccount] = useState<string>("");
  const [loader, setLoader] = useState<boolean>(true);
  const [supplyChain, setSupplyChain] = useState<any>(null);
  const [counts, setCounts] = useState<Counts>({
    manufacturers: 0,
    distributors: 0,
    retailers: 0,
    medicines: 0,
  });
  const [recentMedicines, setRecentMedicines] = useState<Medicine[]>([]);
  const [myInventory, setMyInventory] = useState<Medicine[]>([]);
  const [pendingShipments, setPendingShipments] = useState<Medicine[]>([]);
  const [apiStatus, setApiStatus] = useState<ApiStatus>({ connected: false, message: 'Checking...' });

  // Check backend API health
  const checkApiHealth = useCallback(async () => {
    try {
      const response = await healthCheck();
      if (response.success) {
        setApiStatus({ connected: true, message: 'Backend API connected' });
      } else {
        setApiStatus({ connected: false, message: 'Backend API offline' });
      }
    } catch {
      setApiStatus({ connected: false, message: 'Backend API unreachable' });
    }
  }, []);

  const loadBlockchainData = useCallback(async () => {
    setLoader(true);
    if (typeof window !== 'undefined' && window.ethereum) {
      const web3 = new Web3(window.ethereum);
      const accounts = await web3.eth.getAccounts();
      
      if (accounts.length === 0) {
        router.push('/');
        return;
      }

      setCurrentAccount(accounts[0]);
      const contract = new web3.eth.Contract(
        SupplyChainABI.abi as any,
        getContractAddress()
      );
      setSupplyChain(contract);

      const manCtr = await contract.methods.manCtr().call();
      const disCtr = await contract.methods.disCtr().call();
      const retCtr = await contract.methods.retCtr().call();
      const medCtr = await contract.methods.medicineCtr().call();

      setCounts({
        manufacturers: Number(manCtr),
        distributors: Number(disCtr),
        retailers: Number(retCtr),
        medicines: Number(medCtr),
      });

      // Load recent medicines from blockchain
      const meds: Medicine[] = [];
      const medCount = Number(medCtr);
      const start = Math.max(1, medCount - 4);
      const chainIds: number[] = [];
      
      for (let i = medCount; i >= start; i--) {
        try {
          const med = await contract.methods.MedicineStock(i).call() as {
            id: bigint;
            createdBy: string;
            stage: bigint;
            createdAt: bigint;
            updatedAt: bigint;
          };
          meds.push({
            id: Number(med.id),
            name: `Product #${med.id}`,
            description: 'Loading metadata...',
            stage: Number(med.stage),
            hasMetadata: false
          });
          chainIds.push(Number(med.id));
        } catch (error) {
          console.warn(`Could not load medicine ${i}:`, error);
        }
      }

      // Fetch off-chain metadata
      if (chainIds.length > 0) {
        try {
          const metadataResponse = await getProductsBatch(chainIds);
          if (metadataResponse.success && metadataResponse.data) {
            metadataResponse.data.forEach((metadata, index) => {
              if (metadata && meds[index]) {
                meds[index].hasMetadata = true;
                meds[index].batchNumber = metadata.batchNumber;
                meds[index].manufacturer = metadata.manufacturer;
                meds[index].name = metadata.name || `Product #${meds[index].id}`;
                meds[index].description = metadata.description || 'No description available';
              } else if (meds[index]) {
                meds[index].description = 'No metadata available';
              }
            });
          }
        } catch (error) {
          console.warn('Could not fetch off-chain metadata:', error);
          meds.forEach(med => {
            med.description = 'Metadata unavailable';
          });
        }
      }

      setRecentMedicines(meds);
      setLoader(false);
    } else {
      router.push('/');
    }
  }, [router]);

  // Load role-specific inventory data
  const loadInventoryData = useCallback(async () => {
    if (!supplyChain || !currentAccount || role === 'LOADING' || role === 'UNREGISTERED') return;

    try {
      const allMeds: Medicine[] = [];
      const pending: Medicine[] = [];
      const medCtr = await supplyChain.methods.medicineCtr().call();
      const medCount = Number(medCtr);

      for (let i = 1; i <= medCount; i++) {
        const med = await supplyChain.methods.MedicineStock(i).call() as {
          id: bigint;
          createdBy: string;
          stage: bigint;
        };
        const stage = Number(med.stage);
        const medItem: Medicine = {
          id: Number(med.id),
          name: `Product #${med.id}`,
          description: '',
          stage,
        };

        // Role-specific inventory logic
        if (role === 'MANUFACTURER') {
          // Manufacturer sees products they created at stage 0 or 1
          if (med.createdBy.toLowerCase() === currentAccount.toLowerCase() && stage <= 1) {
            allMeds.push(medItem);
          }
        } else if (role === 'DISTRIBUTOR') {
          // Distributor sees products shipped to them (stage 2) or in their possession (stage 3)
          if (stage === 2) {
            pending.push(medItem);
          } else if (stage === 3) {
            allMeds.push(medItem);
          }
        } else if (role === 'RETAILER') {
          // Retailer sees products shipped to them (stage 4) or in their possession (stage 5)
          if (stage === 4) {
            pending.push(medItem);
          } else if (stage === 5) {
            allMeds.push(medItem);
          }
        }
      }

      // Fetch metadata for inventory items
      const inventoryIds = [...allMeds, ...pending].map(m => m.id);
      if (inventoryIds.length > 0) {
        try {
          const metadataResponse = await getProductsBatch(inventoryIds);
          if (metadataResponse.success && metadataResponse.data) {
            const combined = [...allMeds, ...pending];
            metadataResponse.data.forEach((metadata, index) => {
              if (metadata && combined[index]) {
                combined[index].hasMetadata = true;
                combined[index].batchNumber = metadata.batchNumber;
                combined[index].name = metadata.name || `Product #${combined[index].id}`;
                combined[index].description = metadata.description || '';
              }
            });
          }
        } catch (error) {
          console.warn('Could not fetch inventory metadata:', error);
        }
      }

      setMyInventory(allMeds);
      setPendingShipments(pending);
    } catch (error) {
      console.error('Error loading inventory:', error);
    }
  }, [supplyChain, currentAccount, role]);

  useEffect(() => {
    loadBlockchainData();
    checkApiHealth();
  }, [loadBlockchainData, checkApiHealth]);

  useEffect(() => {
    if (supplyChain && currentAccount && role !== 'LOADING') {
      loadInventoryData();
    }
  }, [supplyChain, currentAccount, role, loadInventoryData]);

  if (loader || role === 'LOADING') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  const getStageColor = (stage: number) => {
    const colors = [
      "bg-blue-500",      // Manufactured
      "bg-cyan-500",      // Packed
      "bg-orange-500",    // ShippedToDistributor
      "bg-yellow-500",    // ReceivedByDistributor
      "bg-purple-500",    // ShippedToRetailer
      "bg-pink-500",      // ReceivedByRetailer
      "bg-green-500"      // Sold
    ];
    return colors[stage] || colors[0];
  };

  const getStageIcon = (stage: number) => {
    const icons = [
      <Icons.Manufacture key="manu" className="w-4 h-4" />,
      <Icons.Products key="pack" className="w-4 h-4" />,
      <Icons.Distribution key="ship1" className="w-4 h-4" />,
      <Icons.Distribution key="recv1" className="w-4 h-4" />,
      <Icons.Distribution key="ship2" className="w-4 h-4" />,
      <Icons.Retail key="recv2" className="w-4 h-4" />,
      <Icons.Sold key="sold" className="w-4 h-4" />
    ];
    return icons[stage] || icons[0];
  };

  // ===== OWNER VIEW =====
  const renderOwnerView = () => (
    <>
      {/* Stats Grid for Owner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white">
              <Icons.Manufacture className="w-8 h-8" />
            </div>
            <span className="text-3xl font-bold text-white">{counts.manufacturers}</span>
          </div>
          <h3 className="text-gray-400 text-sm font-medium">Manufacturers</h3>
        </div>
        <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
              <Icons.Distribution className="w-8 h-8" />
            </div>
            <span className="text-3xl font-bold text-white">{counts.distributors}</span>
          </div>
          <h3 className="text-gray-400 text-sm font-medium">Distributors</h3>
        </div>
        <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white">
              <Icons.Retail className="w-8 h-8" />
            </div>
            <span className="text-3xl font-bold text-white">{counts.retailers}</span>
          </div>
          <h3 className="text-gray-400 text-sm font-medium">Retailers</h3>
        </div>
      </div>

      {/* User Management Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white text-xl font-semibold mb-1">User Management</h2>
            <p className="text-indigo-100 text-sm">Register participants in the supply chain network</p>
          </div>
          <button
            onClick={() => router.push('/roles')}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl font-medium transition-colors"
          >
            Manage Participants
          </button>
        </div>
      </div>

      {/* Quick Actions for Owner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <button
          onClick={() => router.push('/roles')}
          className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50 hover:border-blue-500/50 hover:bg-[#16161f] transition-all duration-300 text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
            <Icons.Participants className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-white font-semibold mb-1">Register Participants</h3>
          <p className="text-gray-400 text-sm">Add manufacturers, distributors & retailers to the network</p>
        </button>

        <button
          onClick={() => router.push('/track')}
          className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50 hover:border-purple-500/50 hover:bg-[#16161f] transition-all duration-300 text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
            <Icons.Track className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="text-white font-semibold mb-1">Track Products</h3>
          <p className="text-gray-400 text-sm">View complete product history & QR codes</p>
        </button>
      </div>
    </>
  );

  // ===== MANUFACTURER VIEW =====
  const renderManufacturerView = () => (
    <>
      {/* Production Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white text-xl font-semibold mb-1">Production Management</h2>
              <p className="text-blue-100 text-sm">Create and manage pharmaceutical products</p>
            </div>
            <button
              onClick={() => router.push('/addmed')}
              className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              <Icons.Products className="w-5 h-5" />
              Create Product
            </button>
          </div>
        </div>

        <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white">
              <Icons.Products className="w-8 h-8" />
            </div>
            <span className="text-3xl font-bold text-white">{myInventory.length}</span>
          </div>
          <h3 className="text-gray-400 text-sm font-medium">Products in Inventory</h3>
        </div>
      </div>

      {/* My Inventory */}
      <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">My Inventory</h2>
          <button 
            onClick={() => router.push('/tasks')}
            className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
          >
            Manage Tasks →
          </button>
        </div>
        
        {myInventory.length === 0 ? (
          <div className="text-center py-12">
            <Icons.Products className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No products in your inventory</p>
            <button 
              onClick={() => router.push('/addmed')}
              className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Create First Product
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {myInventory.slice(0, 5).map((med) => (
              <div 
                key={med.id}
                className="flex items-center justify-between p-4 bg-[#0a0a0f] rounded-xl"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <span className="text-blue-400 font-bold">#{med.id}</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{med.name}</h4>
                    {med.batchNumber && (
                      <p className="text-gray-500 text-sm">Batch: {med.batchNumber}</p>
                    )}
                  </div>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getStageColor(med.stage)} bg-opacity-20`}>
                  {getStageIcon(med.stage)}
                  <span className="text-white text-sm font-medium">{stageNames[med.stage]}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          onClick={() => router.push('/addmed')}
          className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50 hover:border-blue-500/50 hover:bg-[#16161f] transition-all duration-300 text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
            <Icons.Products className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-white font-semibold mb-1">Create Product</h3>
          <p className="text-gray-400 text-sm">Register new pharmaceutical products</p>
        </button>

        <button
          onClick={() => router.push('/tasks')}
          className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50 hover:border-green-500/50 hover:bg-[#16161f] transition-all duration-300 text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4 group-hover:bg-green-500/20 transition-colors">
            <Icons.Manufacture className="w-6 h-6 text-green-400" />
          </div>
          <h3 className="text-white font-semibold mb-1">Pack & Ship</h3>
          <p className="text-gray-400 text-sm">Pack products and ship to distributors</p>
        </button>

        <button
          onClick={() => router.push('/track')}
          className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50 hover:border-purple-500/50 hover:bg-[#16161f] transition-all duration-300 text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
            <Icons.Track className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="text-white font-semibold mb-1">Track Products</h3>
          <p className="text-gray-400 text-sm">View complete product history</p>
        </button>
      </div>
    </>
  );

  // ===== DISTRIBUTOR VIEW =====
  const renderDistributorView = () => (
    <>
      {/* Logistics Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gradient-to-br from-orange-600 to-amber-600 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white text-xl font-semibold mb-1">Inbound Shipments</h2>
              <p className="text-orange-100 text-sm">Products pending your receipt</p>
            </div>
            <span className="text-4xl font-bold text-white">{pendingShipments.length}</span>
          </div>
        </div>

        <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
              <Icons.Distribution className="w-8 h-8" />
            </div>
            <span className="text-3xl font-bold text-white">{myInventory.length}</span>
          </div>
          <h3 className="text-gray-400 text-sm font-medium">Products in Warehouse</h3>
        </div>
      </div>

      {/* Pending Shipments */}
      {pendingShipments.length > 0 && (
        <div className="bg-[#12121a] rounded-2xl p-6 border border-orange-500/30 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
              <h2 className="text-xl font-semibold text-white">Pending Receipts</h2>
            </div>
            <button 
              onClick={() => router.push('/tasks')}
              className="px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg text-sm font-medium transition-colors"
            >
              Receive Products
            </button>
          </div>
          
          <div className="space-y-4">
            {pendingShipments.map((med) => (
              <div 
                key={med.id}
                className="flex items-center justify-between p-4 bg-[#0a0a0f] rounded-xl border border-orange-500/20"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                    <span className="text-orange-400 font-bold">#{med.id}</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{med.name}</h4>
                    <p className="text-gray-500 text-sm">Awaiting receipt confirmation</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm font-medium">
                  In Transit
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warehouse Inventory */}
      <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Warehouse Inventory</h2>
          <button 
            onClick={() => router.push('/tasks')}
            className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
          >
            Ship to Retailers →
          </button>
        </div>
        
        {myInventory.length === 0 ? (
          <div className="text-center py-12">
            <Icons.Distribution className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No products in warehouse</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myInventory.slice(0, 5).map((med) => (
              <div 
                key={med.id}
                className="flex items-center justify-between p-4 bg-[#0a0a0f] rounded-xl"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <span className="text-purple-400 font-bold">#{med.id}</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{med.name}</h4>
                    {med.batchNumber && (
                      <p className="text-gray-500 text-sm">Batch: {med.batchNumber}</p>
                    )}
                  </div>
                </div>
                <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-medium">
                  Ready to Ship
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={() => router.push('/tasks')}
          className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50 hover:border-orange-500/50 hover:bg-[#16161f] transition-all duration-300 text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center mb-4 group-hover:bg-orange-500/20 transition-colors">
            <Icons.Distribution className="w-6 h-6 text-orange-400" />
          </div>
          <h3 className="text-white font-semibold mb-1">Receive Shipments</h3>
          <p className="text-gray-400 text-sm">Confirm receipt of products from manufacturers</p>
        </button>

        <button
          onClick={() => router.push('/track')}
          className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50 hover:border-purple-500/50 hover:bg-[#16161f] transition-all duration-300 text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
            <Icons.Track className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="text-white font-semibold mb-1">Track Products</h3>
          <p className="text-gray-400 text-sm">View complete product history</p>
        </button>
      </div>
    </>
  );

  // ===== RETAILER VIEW =====
  const renderRetailerView = () => (
    <>
      {/* Store Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gradient-to-br from-pink-600 to-rose-600 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white text-xl font-semibold mb-1">Incoming Deliveries</h2>
              <p className="text-pink-100 text-sm">Products awaiting your receipt</p>
            </div>
            <span className="text-4xl font-bold text-white">{pendingShipments.length}</span>
          </div>
        </div>

        <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white">
              <Icons.Retail className="w-8 h-8" />
            </div>
            <span className="text-3xl font-bold text-white">{myInventory.length}</span>
          </div>
          <h3 className="text-gray-400 text-sm font-medium">Products in Store</h3>
        </div>
      </div>

      {/* Pending Deliveries */}
      {pendingShipments.length > 0 && (
        <div className="bg-[#12121a] rounded-2xl p-6 border border-pink-500/30 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-pink-500 rounded-full animate-pulse"></div>
              <h2 className="text-xl font-semibold text-white">Pending Deliveries</h2>
            </div>
            <button 
              onClick={() => router.push('/tasks')}
              className="px-4 py-2 bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 rounded-lg text-sm font-medium transition-colors"
            >
              Receive Products
            </button>
          </div>
          
          <div className="space-y-4">
            {pendingShipments.map((med) => (
              <div 
                key={med.id}
                className="flex items-center justify-between p-4 bg-[#0a0a0f] rounded-xl border border-pink-500/20"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-pink-500/10 rounded-lg flex items-center justify-center">
                    <span className="text-pink-400 font-bold">#{med.id}</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{med.name}</h4>
                    <p className="text-gray-500 text-sm">From distributor</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-pink-500/20 text-pink-400 rounded-full text-sm font-medium">
                  In Transit
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Store Stock */}
      <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Store Stock</h2>
          <button 
            onClick={() => router.push('/tasks')}
            className="text-green-400 hover:text-green-300 text-sm font-medium transition-colors"
          >
            Sell Products →
          </button>
        </div>
        
        {myInventory.length === 0 ? (
          <div className="text-center py-12">
            <Icons.Retail className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No products in store</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myInventory.slice(0, 5).map((med) => (
              <div 
                key={med.id}
                className="flex items-center justify-between p-4 bg-[#0a0a0f] rounded-xl"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <span className="text-green-400 font-bold">#{med.id}</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{med.name}</h4>
                    {med.batchNumber && (
                      <p className="text-gray-500 text-sm">Batch: {med.batchNumber}</p>
                    )}
                  </div>
                </div>
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                  Available for Sale
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={() => router.push('/tasks')}
          className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50 hover:border-green-500/50 hover:bg-[#16161f] transition-all duration-300 text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4 group-hover:bg-green-500/20 transition-colors">
            <Icons.Sold className="w-6 h-6 text-green-400" />
          </div>
          <h3 className="text-white font-semibold mb-1">Sell Products</h3>
          <p className="text-gray-400 text-sm">Mark products as sold to customers</p>
        </button>

        <button
          onClick={() => router.push('/track')}
          className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50 hover:border-purple-500/50 hover:bg-[#16161f] transition-all duration-300 text-left group"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
            <Icons.Track className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="text-white font-semibold mb-1">Track Products</h3>
          <p className="text-gray-400 text-sm">View complete product history</p>
        </button>
      </div>
    </>
  );

  // ===== UNREGISTERED VIEW =====
  const renderUnregisteredView = () => (
    <>
      {/* Stats Grid for Unregistered */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white">
              <Icons.Manufacture className="w-8 h-8" />
            </div>
            <span className="text-3xl font-bold text-white">{counts.manufacturers}</span>
          </div>
          <h3 className="text-gray-400 text-sm font-medium">Manufacturers</h3>
        </div>
        <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
              <Icons.Distribution className="w-8 h-8" />
            </div>
            <span className="text-3xl font-bold text-white">{counts.distributors}</span>
          </div>
          <h3 className="text-gray-400 text-sm font-medium">Distributors</h3>
        </div>
        <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white">
              <Icons.Retail className="w-8 h-8" />
            </div>
            <span className="text-3xl font-bold text-white">{counts.retailers}</span>
          </div>
          <h3 className="text-gray-400 text-sm font-medium">Retailers</h3>
        </div>
        <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50">
          <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white">
              <Icons.Products className="w-8 h-8" />
            </div>
            <span className="text-3xl font-bold text-white">{counts.medicines}</span>
          </div>
          <h3 className="text-gray-400 text-sm font-medium">Total Products</h3>
        </div>
      </div>

      {/* Unregistered Info Card */}
      <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white text-xl font-semibold mb-1">Welcome, Unregistered User</h2>
            <p className="text-gray-300 text-sm">You are not registered in the supply chain network. Contact the owner to get registered.</p>
          </div>
          <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center">
            <Icons.Participants className="w-10 h-10 text-white/50" />
          </div>
        </div>
      </div>

      {/* Track Products */}
      <button
        onClick={() => router.push('/track')}
        className="w-full bg-[#12121a] rounded-2xl p-6 border border-gray-800/50 hover:border-purple-500/50 hover:bg-[#16161f] transition-all duration-300 text-left group"
      >
        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
          <Icons.Track className="w-6 h-6 text-purple-400" />
        </div>
        <h3 className="text-white font-semibold mb-1">Track Products</h3>
        <p className="text-gray-400 text-sm">View complete product history & QR codes (available to everyone)</p>
      </button>

      {/* Recent Products */}
      <div className="bg-[#12121a] rounded-2xl p-6 border border-gray-800/50 mt-8">
        <h2 className="text-xl font-semibold text-white mb-6">Recent Products</h2>
        
        {recentMedicines.length === 0 ? (
          <div className="text-center py-12">
            <Icons.Products className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No products registered yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentMedicines.map((med) => (
              <div 
                key={med.id}
                className="flex items-center justify-between p-4 bg-[#0a0a0f] rounded-xl"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <span className="text-blue-400 font-bold">#{med.id}</span>
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{med.name}</h4>
                    <p className="text-gray-500 text-sm truncate max-w-xs">{med.description}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getStageColor(med.stage)} bg-opacity-20`}>
                  {getStageIcon(med.stage)}
                  <span className="text-white text-sm font-medium">{stageNames[med.stage]}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  // Render appropriate view based on role
  const renderRoleView = () => {
    if (isOwner()) return renderOwnerView();
    if (isManufacturer()) return renderManufacturerView();
    if (isDistributor()) return renderDistributorView();
    if (isRetailer()) return renderRetailerView();
    return renderUnregisteredView();
  };

  const getRoleTitle = () => {
    if (isOwner()) return "Owner Dashboard";
    if (isManufacturer()) return "Manufacturer Dashboard";
    if (isDistributor()) return "Distributor Dashboard";
    if (isRetailer()) return "Retailer Dashboard";
    return "Supply Chain Overview";
  };

  const getRoleSubtitle = () => {
    if (isOwner()) return "Manage participants and oversee the supply chain network";
    if (isManufacturer()) return "Create products and ship to distributors";
    if (isDistributor()) return "Manage warehouse inventory and logistics";
    if (isRetailer()) return "Manage store stock and sell to customers";
    return "View supply chain information";
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      <Sidebar currentAccount={currentAccount} />

      {/* Main Content */}
      <div className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">{getRoleTitle()}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                isOwner() ? 'bg-indigo-500/20 text-indigo-400' :
                isManufacturer() ? 'bg-blue-500/20 text-blue-400' :
                isDistributor() ? 'bg-purple-500/20 text-purple-400' :
                isRetailer() ? 'bg-green-500/20 text-green-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {getRoleDisplayName()}
              </span>
            </div>
            <p className="text-gray-400">{getRoleSubtitle()}</p>
          </div>
          {/* API Status Indicator */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            apiStatus.connected 
              ? 'bg-green-500/10 border border-green-500/30' 
              : 'bg-red-500/10 border border-red-500/30'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              apiStatus.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`} />
            <span className={`text-xs font-medium ${
              apiStatus.connected ? 'text-green-400' : 'text-red-400'
            }`}>
              {apiStatus.connected ? 'Hybrid Mode' : 'Blockchain Only'}
            </span>
          </div>
        </div>

        {/* Role-specific View */}
        {renderRoleView()}
      </div>
    </div>
  );
}
