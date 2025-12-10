import Web3 from 'web3'
import { SupplyChainArtifact } from './contracts'

declare global {
  interface Window {
    ethereum?: any
    web3?: Web3
  }
}

export const loadWeb3 = async (): Promise<void> => {
  if (window.ethereum) {
    window.web3 = new Web3(window.ethereum)
    await window.ethereum.request({ method: 'eth_requestAccounts' })
  } else if (window.web3) {
    window.web3 = new Web3(window.web3.currentProvider)
  } else {
    window.alert('Non-Ethereum browser detected. You should consider trying MetaMask!')
  }
}

export const getContract = async () => {
  if (!window.web3) {
    await loadWeb3()
  }

  const web3 = window.web3!
  const accounts = await web3.eth.getAccounts()
  const networkId = await web3.eth.net.getId()
  
  // Import deployment info
  const deployments = await import('../deployments.json')
  const networkIdStr = networkId.toString()
  const networkData = deployments.networks[networkIdStr as keyof typeof deployments.networks] as { SupplyChain?: { address: string } } | undefined

  if (networkData?.SupplyChain?.address) {
    const contract = new web3.eth.Contract(SupplyChainArtifact.abi as any, networkData.SupplyChain.address)
    return { contract, account: accounts[0], web3 }
  } else {
    // Get available networks from deployments
    const availableNetworks = Object.keys(deployments.networks).join(', ')
    throw new Error(
      `Contract not found on network ${networkIdStr}.\n\n` +
      `Available networks: ${availableNetworks}\n` +
      `Please switch MetaMask to one of these networks or deploy the contract to network ${networkIdStr}.\n\n` +
      `To deploy: npx hardhat run scripts/deploy.ts --network <network>`
    )
  }
}

export const switchToNetwork = async (chainId: string | number) => {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed')
  }

  const chainIdHex = `0x${Number(chainId).toString(16)}`
  
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    })
  } catch (switchError: any) {
    // This error code indicates that the chain has not been added to MetaMask
    if (switchError.code === 4902) {
      // Try to add the network
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: chainIdHex,
              chainName: 'Hardhat Local',
              nativeCurrency: {
                name: 'Ethereum',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: ['http://127.0.0.1:8545'],
              blockExplorerUrls: [],
            },
          ],
        })
      } catch (addError) {
        throw new Error('Failed to add network to MetaMask')
      }
    } else {
      throw switchError
    }
  }
}

// Switch to Hardhat network (1337) if not already on it
export const ensureCorrectNetwork = async (): Promise<boolean> => {
  if (!window.ethereum) return false
  
  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' })
    const currentChainId = parseInt(chainId, 16)
    
    // If already on Hardhat (1337), we're good
    if (currentChainId === 1337) {
      return true
    }
    
    // Try to switch to Hardhat network
    await switchToNetwork(1337)
    return true
  } catch (error) {
    console.error('Failed to switch network:', error)
    return false
  }
}
