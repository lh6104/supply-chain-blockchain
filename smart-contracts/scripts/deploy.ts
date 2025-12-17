import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // Deploy SupplyChain contract
  const SupplyChain = await ethers.getContractFactory("SupplyChain");
  const supplyChain = await SupplyChain.deploy();
  await supplyChain.waitForDeployment();

  const contractAddress = await supplyChain.getAddress();
  console.log("SupplyChain deployed to:", contractAddress);

  // Get the network
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId.toString();
  console.log("Network chainId:", chainId);

  // Update deployments.json in client
  const deploymentsPath = path.join(__dirname, "../../client/src/deployments.json");
  
  let deployments: any = { networks: {} };
  
  // Read existing deployments if file exists
  if (fs.existsSync(deploymentsPath)) {
    try {
      const content = fs.readFileSync(deploymentsPath, "utf8");
      deployments = JSON.parse(content);
    } catch (e) {
      console.log("Creating new deployments.json");
    }
  }

  // Update with new deployment
  if (!deployments.networks) {
    deployments.networks = {};
  }
  
  deployments.networks[chainId] = {
    SupplyChain: {
      address: contractAddress
    }
  };

  // Write updated deployments
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log("Updated deployments.json with contract address");

  // Verify owner
  const owner = await supplyChain.Owner();
  console.log("Contract owner:", owner);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

