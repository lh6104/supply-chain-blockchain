import { ethers } from 'hardhat'
import * as fs from 'fs'



























































































































































  })    process.exit(1)    console.error('❌ Seeding failed:', error)  .catch((error) => {  .then(() => process.exit(0))main()}  console.log('')  console.log('   3. Connect and test the workflow!')  console.log('   2. Import any account above into MetaMask')  console.log('   1. Start frontend: cd ../client && npm run dev')  console.log('\n📌 Next Steps:')  console.log('└─────────────────┴────────────────────────────────────────────────────────────────────┘')  console.log('│ Retailer        │ 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6 │')  console.log('│ Distributor     │ 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a │')  console.log('│ Manufacturer    │ 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d │')  console.log('│ Owner           │ 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 │')  console.log('├─────────────────┼────────────────────────────────────────────────────────────────────┤')  console.log('│ Role            │ Private Key                                                        │')  console.log('┌─────────────────┬────────────────────────────────────────────────────────────────────┐')  console.log('\n🎮 Ready to Demo! Use these accounts in MetaMask:\n')  console.log('═══════════════════════════════════════════════════════════')  console.log('')  console.log('   └── Medicine #1 (Stage: Manufactured)')  console.log('   Sample Data:')  console.log('')  console.log('   └── Retailer:     HealthMart Pharmacy')  console.log('   ├── Distributor:  MedLogistics')  console.log('   ├── Manufacturer: PharmaCorp')  console.log('   Registered Participants:')  console.log('')  console.log('   Chain ID:', chainId)  console.log('   Contract Address:', contractAddress)  console.log('\n📊 Summary:')  console.log('═══════════════════════════════════════════════════════════')  console.log('                    ✅ SEEDING COMPLETE!')  console.log('\n═══════════════════════════════════════════════════════════')    // ═══════════════════════════════════════════════════════════  // SUMMARY  // ═══════════════════════════════════════════════════════════  console.log('   ✓ client/src/deployments.json updated')  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2))  }    }      seeded: true,      deployer: owner.address,      deployedAt: new Date().toISOString(),      address: contractAddress,    SupplyChain: {  deployments.networks[chainId] = {  }    deployments.networks = {}  if (!deployments.networks) {  }    deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'))  if (fs.existsSync(deploymentsPath)) {  let deployments: any = { networks: {} }    const deploymentsPath = path.join(clientDir, 'deployments.json')  const clientDir = path.join(__dirname, '../../client/src')    console.log('\n📁 Step 4: Updating client configuration...')    // ═══════════════════════════════════════════════════════════  // STEP 4: UPDATE CLIENT DEPLOYMENTS  // ═══════════════════════════════════════════════════════════  console.log('   Total medicines:', medicineCount.toString())  console.log('   ✓ Medicine #1 created by Manufacturer')  const medicineCount = await supplyChain.medicineCtr()    await medTx.wait()  const medTx = await supplyChainAsManufacturer.addMedicine()  const supplyChainAsManufacturer = supplyChain.connect(manufacturer)  // Connect as manufacturer to create medicine    console.log('\n💊 Step 3: Creating sample medicine...')    // ═══════════════════════════════════════════════════════════  // STEP 3: CREATE SAMPLE MEDICINE (as Manufacturer)  // ═══════════════════════════════════════════════════════════  console.log('   ✓ Retailer registered:', retailer.address)  await retTx.wait()  const retTx = await supplyChain.addRetailer(retailer.address, 'HealthMart Pharmacy', 'Los Angeles, USA')  console.log('   Registering Retailer...')  // Register Retailer  console.log('   ✓ Distributor registered:', distributor.address)  await disTx.wait()  const disTx = await supplyChain.addDistributor(distributor.address, 'MedLogistics', 'Chicago, USA')  console.log('   Registering Distributor...')  // Register Distributor  console.log('   ✓ Manufacturer registered:', manufacturer.address)  await manTx.wait()  const manTx = await supplyChain.addManufacturer(manufacturer.address, 'PharmaCorp', 'New York, USA')  console.log('   Registering Manufacturer...')  // Register Manufacturer  console.log('\n👥 Step 2: Registering participants...')    // ═══════════════════════════════════════════════════════════  // STEP 2: REGISTER PARTICIPANTS  // ═══════════════════════════════════════════════════════════  console.log('   ✓ Contract deployed to:', contractAddress)  const chainId = network.chainId.toString()  const network = await ethers.provider.getNetwork()  const contractAddress = await supplyChain.getAddress()  await supplyChain.waitForDeployment()  const supplyChain = await SupplyChain.deploy()  const SupplyChain = await ethers.getContractFactory('SupplyChain')  console.log('\n🚀 Step 1: Deploying SupplyChain contract...')    // ═══════════════════════════════════════════════════════════  // STEP 1: DEPLOY CONTRACT  // ═══════════════════════════════════════════════════════════  console.log('   [3] Retailer:     ', retailer.address)  console.log('   [2] Distributor:  ', distributor.address)  console.log('   [1] Manufacturer: ', manufacturer.address)  console.log('   [0] Owner:        ', owner.address)  console.log('\n📋 Test Accounts:')  const [owner, manufacturer, distributor, retailer] = signers  const signers = await ethers.getSigners()  // Get signers (Hardhat accounts)  console.log('═══════════════════════════════════════════════════════════')  console.log('       SUPPLY CHAIN - DEPLOY & SEED TEST DATA')  console.log('═══════════════════════════════════════════════════════════')async function main() { */ * Usage: npx hardhat run scripts/seed.ts --network localhost *  * 3. Optionally creates a sample medicine for testing * 2. Registers test accounts as Manufacturer, Distributor, Retailer * 1. Deploys a fresh SupplyChain contract * This script: *  * Seed Script - Deploy contract and register test participants/**import * as path from 'path'import * as path from 'path'

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('           SUPPLY CHAIN CONTRACT DEPLOYMENT')
  console.log('═══════════════════════════════════════════════════════════')

  const [deployer] = await ethers.getSigners()
  console.log('\n📋 Deployment Info:')
  console.log('   Deployer:', deployer.address)
  
  const balance = await ethers.provider.getBalance(deployer.address)
  console.log('   Balance:', ethers.formatEther(balance), 'ETH')

  if (balance === 0n) {
    throw new Error('Account has no funds. Please fund the account or use a different account.')
  }

  // Deploy the contract
  console.log('\n🚀 Deploying SupplyChain contract...')
  const SupplyChain = await ethers.getContractFactory('SupplyChain')
  const supplyChain = await SupplyChain.deploy()

  await supplyChain.waitForDeployment()

  const address = await supplyChain.getAddress()
  const network = await ethers.provider.getNetwork()
  const chainId = network.chainId.toString()

  console.log('\n✅ Deployment Successful!')
  console.log('   Contract Address:', address)
  console.log('   Network Chain ID:', chainId)
  console.log('   Owner:', deployer.address)

  // ═══════════════════════════════════════════════════════════
  // UPDATE CLIENT DEPLOYMENTS
  // ═══════════════════════════════════════════════════════════
  
  const clientDir = path.join(__dirname, '../../client/src')
  const deploymentsPath = path.join(clientDir, 'deployments.json')
  
  // Ensure deployments.json exists
  let deployments: any = { networks: {} }
  if (fs.existsSync(deploymentsPath)) {
    deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'))
  }

  if (!deployments.networks) {
    deployments.networks = {}
  }

  if (!deployments.networks[chainId]) {
    deployments.networks[chainId] = {}
  }

  deployments.networks[chainId].SupplyChain = {
    address: address,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  }

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2))
  console.log('\n📁 Files Updated:')
  console.log('   ✓ client/src/deployments.json')

  // ═══════════════════════════════════════════════════════════
  // VERIFY ABI EXISTS
  // ═══════════════════════════════════════════════════════════
  
  const abiPath = path.join(clientDir, 'artifacts/contracts/SupplyChain.sol/SupplyChain.json')
  if (fs.existsSync(abiPath)) {
    console.log('   ✓ ABI available at artifacts/contracts/SupplyChain.sol/')
  } else {
    console.log('   ⚠ ABI not found - run `npx hardhat compile` first')
  }

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('   🎉 Deployment complete! Frontend ready to connect.')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('\n📌 Next Steps:')
  console.log('   1. Start frontend: cd ../client && npm run dev')
  console.log('   2. Connect MetaMask with Account #0 (Owner)')
  console.log('   3. Or run seed script: npx hardhat run scripts/seed.ts --network localhost')
  console.log('')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

