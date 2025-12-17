import { ethers } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Seed Script - Deploy contract and register test participants
 * 
 * Usage: npx hardhat run scripts/seed.ts --network localhost
 */

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('       SUPPLY CHAIN - DEPLOY & SEED TEST DATA')
  console.log('═══════════════════════════════════════════════════════════')

  const signers = await ethers.getSigners()
  const [owner, manufacturer, distributor, retailer] = signers

  console.log('\n📋 Test Accounts:')
  console.log('   [0] Owner:        ', owner.address)
  console.log('   [1] Manufacturer: ', manufacturer.address)
  console.log('   [2] Distributor:  ', distributor.address)
  console.log('   [3] Retailer:     ', retailer.address)

  // STEP 1: DEPLOY CONTRACT
  console.log('\n🚀 Step 1: Deploying SupplyChain contract...')
  const SupplyChain = await ethers.getContractFactory('SupplyChain')
  const supplyChain = await SupplyChain.deploy()
  await supplyChain.waitForDeployment()

  const contractAddress = await supplyChain.getAddress()
  const network = await ethers.provider.getNetwork()
  const chainId = network.chainId.toString()

  console.log('   ✓ Contract deployed to:', contractAddress)

  // STEP 2: REGISTER PARTICIPANTS (address, name, place required)
  console.log('\n👥 Step 2: Registering participants...')

  console.log('   Registering Manufacturer...')
  const manTx = await supplyChain.addManufacturer(manufacturer.address, 'PharmaCorp Manufacturing', 'New York, USA')
  await manTx.wait()
  console.log('   ✓ Manufacturer registered:', manufacturer.address)

  console.log('   Registering Distributor...')
  const disTx = await supplyChain.addDistributor(distributor.address, 'Global Pharma Distribution', 'Chicago, USA')
  await disTx.wait()
  console.log('   ✓ Distributor registered:', distributor.address)

  console.log('   Registering Retailer...')
  const retTx = await supplyChain.addRetailer(retailer.address, 'HealthMart Pharmacy', 'Los Angeles, USA')
  await retTx.wait()
  console.log('   ✓ Retailer registered:', retailer.address)

  // STEP 3: CREATE 5 DEMO MEDICINES WITH DIFFERENT STAGES
  console.log('\n💊 Step 3: Creating 5 demo medicines...')
  
  const supplyChainAsManufacturer = supplyChain.connect(manufacturer)
  const supplyChainAsDistributor = supplyChain.connect(distributor)
  const supplyChainAsRetailer = supplyChain.connect(retailer)

  // Product metadata for backend API
  const products = [
    { name: 'Paracetamol 500mg', description: 'Pain relief and fever reducer', batchNumber: 'BATCH-2024-001' },
    { name: 'Amoxicillin 250mg', description: 'Antibiotic for bacterial infections', batchNumber: 'BATCH-2024-002' },
    { name: 'Ibuprofen 400mg', description: 'Anti-inflammatory pain reliever', batchNumber: 'BATCH-2024-003' },
    { name: 'Vitamin D3 1000IU', description: 'Vitamin D supplement for bone health', batchNumber: 'BATCH-2024-004' },
    { name: 'Aspirin 100mg', description: 'Blood thinner and pain reliever', batchNumber: 'BATCH-2024-005' },
  ]

  // Get distributor and retailer IDs
  const distributorId = 1
  const retailerId = 1

  // Create Medicine #1 - Stage: Manufactured (just created)
  console.log('   Creating Medicine #1 (Manufactured)...')
  await (await supplyChainAsManufacturer.addMedicine()).wait()
  console.log('   ✓ Medicine #1: Paracetamol 500mg - Stage: Manufactured')

  // Create Medicine #2 - Stage: Packed
  console.log('   Creating Medicine #2 (Packed)...')
  await (await supplyChainAsManufacturer.addMedicine()).wait()
  await (await supplyChainAsManufacturer.pack(2)).wait()
  console.log('   ✓ Medicine #2: Amoxicillin 250mg - Stage: Packed')

  // Create Medicine #3 - Stage: Shipped to Distributor
  console.log('   Creating Medicine #3 (Shipped to Distributor)...')
  await (await supplyChainAsManufacturer.addMedicine()).wait()
  await (await supplyChainAsManufacturer.pack(3)).wait()
  await (await supplyChainAsManufacturer.shipToDistributor(3, distributorId)).wait()
  console.log('   ✓ Medicine #3: Ibuprofen 400mg - Stage: Shipped to Distributor')

  // Create Medicine #4 - Stage: Received by Distributor
  console.log('   Creating Medicine #4 (Received by Distributor)...')
  await (await supplyChainAsManufacturer.addMedicine()).wait()
  await (await supplyChainAsManufacturer.pack(4)).wait()
  await (await supplyChainAsManufacturer.shipToDistributor(4, distributorId)).wait()
  await (await supplyChainAsDistributor.receiveByDistributor(4)).wait()
  console.log('   ✓ Medicine #4: Vitamin D3 1000IU - Stage: Received by Distributor')

  // Create Medicine #5 - Stage: Sold (complete journey)
  console.log('   Creating Medicine #5 (Sold - Complete Journey)...')
  await (await supplyChainAsManufacturer.addMedicine()).wait()
  await (await supplyChainAsManufacturer.pack(5)).wait()
  await (await supplyChainAsManufacturer.shipToDistributor(5, distributorId)).wait()
  await (await supplyChainAsDistributor.receiveByDistributor(5)).wait()
  await (await supplyChainAsDistributor.shipToRetailer(5, retailerId)).wait()
  await (await supplyChainAsRetailer.receiveByRetailer(5)).wait()
  await (await supplyChainAsRetailer.sell(5)).wait()
  console.log('   ✓ Medicine #5: Aspirin 100mg - Stage: Sold')

  const medicineCount = await supplyChain.medicineCtr()
  console.log('   Total medicines:', medicineCount.toString())

  // STEP 4: SEED BACKEND API WITH PRODUCT METADATA
  console.log('\n🌐 Step 4: Seeding backend API with product metadata...')
  
  try {
    for (let i = 0; i < products.length; i++) {
      const product = products[i]
      const response = await fetch('http://localhost:3001/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainProductId: i + 1,
          name: product.name,
          description: product.description,
          batchNumber: product.batchNumber,
          manufacturer: 'PharmaCorp Manufacturing',
          manufacturerAddress: manufacturer.address,
        })
      })
      if (response.ok) {
        console.log(`   ✓ Product #${i + 1} metadata saved to backend`)
      }
    }
  } catch (err) {
    console.log('   ⚠ Backend API not available - skipping metadata seeding')
  }

  // STEP 5: UPDATE CLIENT DEPLOYMENTS
  console.log('\n📁 Step 5: Updating client configuration...')
  
  const clientDir = path.join(__dirname, '../../client/src')
  const deploymentsPath = path.join(clientDir, 'deployments.json')
  
  let deployments: any = { networks: {} }
  if (fs.existsSync(deploymentsPath)) {
    deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'))
  }

  deployments.networks[chainId] = {
    SupplyChain: {
      address: contractAddress,
      deployedAt: new Date().toISOString(),
      deployer: owner.address,
      seeded: true,
    }
  }

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2))
  console.log('   ✓ client/src/deployments.json updated')

  // SUMMARY
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('                    ✅ SEEDING COMPLETE!')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('\n📊 Summary:')
  console.log('   Contract:', contractAddress)
  console.log('   Chain ID:', chainId)
  console.log('   Participants: Manufacturer, Distributor, Retailer')
  console.log('\n💊 Demo Products:')
  console.log('   #1 Paracetamol 500mg    → Manufactured')
  console.log('   #2 Amoxicillin 250mg    → Packed')
  console.log('   #3 Ibuprofen 400mg      → Shipped to Distributor')
  console.log('   #4 Vitamin D3 1000IU    → Received by Distributor')
  console.log('   #5 Aspirin 100mg        → Sold (Complete Journey)')
  console.log('')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('\n🎮 Ready to Demo! MetaMask Private Keys:\n')
  console.log('   Owner:        0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
  console.log('   Manufacturer: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')
  console.log('   Distributor:  0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a')
  console.log('   Retailer:     0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6')
  console.log('')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  })
