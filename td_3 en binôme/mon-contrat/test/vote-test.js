import chai from "chai";
const { expect } = chai;
import hardhat from "hardhat";
const { ethers } = hardhat;

describe("Vote contract", function () {
  let Vote;
  let vote;
  let owner;
  let addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    Vote = await ethers.getContractFactory("Vote");
    vote = await Vote.deploy();
    await vote.waitForDeployment();
  });

  it("Doit initialiser avec 3 candidats", async function () {
    const count = await vote.getCandidatesCount();
    expect(count).to.equal(3);
  });

  it("Doit permettre de voter pour un candidat valide", async function () {
    await vote.vote(0);
    const votes0 = await vote.getVotes(0);
    expect(votes0).to.equal(1);
  });

  it("Doit rejeter un vote pour un candidat invalide", async function () {
    await expect(vote.vote(99)).to.be.revertedWith("Candidat invalide");
  });

  it("Doit incrémenter correctement les votes", async function () {
    await vote.vote(1);
    await vote.connect(addr1).vote(1);
    const votes1 = await vote.getVotes(1);
    expect(votes1).to.equal(2);
  });

  it("Doit émettre un event Voted lors du vote", async function () {
    await expect(vote.vote(0))
      .to.emit(vote, "Voted")
      .withArgs(0, owner.address);
  });
});
