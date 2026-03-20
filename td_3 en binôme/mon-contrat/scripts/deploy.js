import ethers from "hardhat";

async function main() {
  const Vote = await ethers.ethers.getContractFactory("Vote");
  console.log("Déploiement du contrat Vote...");
  const vote = await Vote.deploy();

  await vote.waitForDeployment();

  console.log("Contrat déployé à l'adresse :", await vote.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
