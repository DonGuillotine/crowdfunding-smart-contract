const hre = require("hardhat");

async function main() {
  const CrowdfundingPlatform = await hre.ethers.getContractFactory("CrowdfundingPlatform");

  console.log("Deploying CrowdfundingPlatform...");
  const crowdfundingPlatform = await CrowdfundingPlatform.deploy();

  await crowdfundingPlatform.waitForDeployment();

  const crowdfundingPlatformAddress = await crowdfundingPlatform.getAddress();

  console.log("CrowdfundingPlatform deployed to:", crowdfundingPlatformAddress);

  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    await crowdfundingPlatform.deploymentTransaction().wait(5);
    
    console.log("Verifying contract...");
    await hre.run("verify:verify", {
      address: crowdfundingPlatformAddress,
      constructorArguments: [],
    });
  }
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });