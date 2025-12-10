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

  // STEP 2: REGISTER PARTICIPANTS (only address required)
  console.log('\n👥 Step 2: Registering participants...')

  console.log('   Registering Manufacturer...')
  const manTx = await supplyChain.addManufacturer(manufacturer.address)
  await manTx.wait()
  console.log('   ✓ Manufacturer registered:', manufacturer.address)

  console.log('   Registering Distributor...')
  const disTx = await supplyChain.addDistributor(distributor.address)
  await disTx.wait()
  console.log('   ✓ Distributor registered:', distributor.address)

  console.log('   Registering Retailer...')
  const retTx = await supplyChain.addRetailer(retailer.address)
  await retTx.wait()
  console.log('   ✓ Retailer registered:', retailer.address)

  // STEP 3: CREATE SAMPLE MEDICINE (as Manufacturer)
  console.log('\n💊 Step 3: Creating sample medicine...')
  
  const supplyChainAsManufacturer = supplyChain.connect(manufacturer)
  const medTx = await supplyChainAsManufacturer.addMedicine()
  await medTx.wait()
  
  const medicineCount = await supplyChain.medicineCtr()
  console.log('   ✓ Medicine #1 created by Manufacturer')
  console.log('   Total medicines:', medicineCount.toString())

  // STEP 4: UPDATE CLIENT DEPLOYMENTS
  console.log('\n📁 Step 4: Updating client configuration...')
  
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
  console.log('   Sample Medicine: #1 (Stage: Manufactured)')
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
