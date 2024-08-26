const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrowdfundingPlatform", function () {
  let CrowdfundingPlatform;
  let crowdfundingPlatform;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  beforeEach(async function () {
    CrowdfundingPlatform = await ethers.getContractFactory("CrowdfundingPlatform");
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    crowdfundingPlatform = await CrowdfundingPlatform.deploy();
    await crowdfundingPlatform.waitForDeployment();
  });


  async function findCampaignCreatedEvent(tx) {
    const receipt = await tx.wait();
    const fullReceipt = await ethers.provider.getTransactionReceipt(receipt.hash);
    
    for (const log of fullReceipt.logs) {
      try {
        const parsedLog = crowdfundingPlatform.interface.parseLog(log);
        if (parsedLog.name === 'CampaignCreated') {
          return parsedLog;
        }
      } catch (error) {
        console.log("Error parsing log:", error);
      }
    }
    
    console.log("Full receipt logs:", fullReceipt.logs);
    throw new Error("CampaignCreated event not found in the logs");
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await crowdfundingPlatform.owner()).to.equal(owner.address);
    });
  });

  
  describe("Campaign Creation", function () {
    it("Should create a campaign with correct details", async function () {
      const tx = await crowdfundingPlatform.createCampaign(
        "Test Campaign",
        "Test Description",
        addr1.address,
        ethers.parseEther("1"),
        86400 
      );

      const campaignCreatedEvent = await findCampaignCreatedEvent(tx);
      
      const campaignId = campaignCreatedEvent.args.campaignId;
      const campaign = await crowdfundingPlatform.getCampaignDetails(campaignId);
      expect(campaign.title).to.equal("Test Campaign");
      expect(campaign.description).to.equal("Test Description");
      expect(campaign.benefactor).to.equal(addr1.address);
      expect(campaign.goal).to.equal(ethers.parseEther("1"));
      expect(campaign.amountRaised).to.equal(0n);
      expect(campaign.ended).to.be.false;
    });

    it("Should fail to create a campaign with invalid parameters", async function () {
      await expect(crowdfundingPlatform.createCampaign(
        "",
        "Test Description",
        addr1.address,
        ethers.parseEther("1"),
        86400
      )).to.be.revertedWith("Title cannot be empty");

      await expect(crowdfundingPlatform.createCampaign(
        "Test Campaign",
        "Test Description",
        ethers.ZeroAddress,
        ethers.parseEther("1"),
        86400
      )).to.be.revertedWith("Invalid benefactor address");

      await expect(crowdfundingPlatform.createCampaign(
        "Test Campaign",
        "Test Description",
        addr1.address,
        0,
        86400
      )).to.be.revertedWith("Goal must be greater than zero");
    });
  });

  describe("Donations", function () {
    let campaignId;

    beforeEach(async function () {
      const tx = await crowdfundingPlatform.createCampaign(
        "Test Campaign",
        "Test Description",
        addr1.address,
        ethers.parseEther("1"),
        86400
      );

      const campaignCreatedEvent = await findCampaignCreatedEvent(tx);
      campaignId = campaignCreatedEvent.args.campaignId;
    });

    it("Should allow donations to active campaigns", async function () {
      await expect(crowdfundingPlatform.connect(addr2).donateToCampaign(campaignId, { value: ethers.parseEther("0.5") }))
        .to.emit(crowdfundingPlatform, "DonationReceived")
        .withArgs(campaignId, addr2.address, ethers.parseEther("0.5"));

      const campaign = await crowdfundingPlatform.getCampaignDetails(campaignId);
      expect(campaign.amountRaised).to.equal(ethers.parseEther("0.5"));
    });

    it("Should fail to donate to non-existent campaigns", async function () {
      await expect(crowdfundingPlatform.donateToCampaign(999, { value: ethers.parseEther("0.5") }))
        .to.be.revertedWith("Invalid campaign ID");
    });

    it("Should fail to donate with zero amount", async function () {
      await expect(crowdfundingPlatform.donateToCampaign(campaignId, { value: 0 }))
        .to.be.revertedWith("Donation amount must be greater than zero");
    });

    it("Should end campaign and transfer funds when goal is reached", async function () {
      const initialBalance = await ethers.provider.getBalance(addr1.address);
      
      console.log("Initial campaign state:", await crowdfundingPlatform.getCampaignDetails(campaignId));
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      const donationTx = await crowdfundingPlatform.connect(addr2).donateToCampaign(campaignId, { value: ethers.parseEther("1") });
      await donationTx.wait();

      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log("Final campaign state:", await crowdfundingPlatform.getCampaignDetails(campaignId));

      const finalBalance = await ethers.provider.getBalance(addr1.address);
      expect(finalBalance - initialBalance).to.equal(ethers.parseEther("1"));

      const campaign = await crowdfundingPlatform.getCampaignDetails(campaignId);
      expect(campaign.ended).to.be.true;
    });
  });

  describe("Ending Campaigns", function () {
    let campaignId;

    beforeEach(async function () {
      const tx = await crowdfundingPlatform.createCampaign(
        "Test Campaign",
        "Test Description",
        addr1.address,
        ethers.parseEther("1"),
        86400
      );

      const campaignCreatedEvent = await findCampaignCreatedEvent(tx);
      campaignId = campaignCreatedEvent.args.campaignId;
    });

    it("Should allow ending a campaign after deadline", async function () {
      await ethers.provider.send("evm_increaseTime", [86401]); 
      await ethers.provider.send("evm_mine");

      await expect(crowdfundingPlatform.endCampaign(campaignId))
        .to.emit(crowdfundingPlatform, "CampaignEnded")
        .withArgs(campaignId, 0, false);

      const campaign = await crowdfundingPlatform.getCampaignDetails(campaignId);
      expect(campaign.ended).to.be.true;
    });

    it("Should not allow ending a campaign before deadline if goal is not reached", async function () {
      await expect(crowdfundingPlatform.endCampaign(campaignId))
        .to.be.revertedWith("Campaign cannot be ended yet");
    });

    it("Should not allow ending an already ended campaign", async function () {
      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine");

      await crowdfundingPlatform.endCampaign(campaignId);

      await expect(crowdfundingPlatform.endCampaign(campaignId))
        .to.be.revertedWith("Campaign has already been ended");
    });
  });

  describe("Utility Functions", function () {
    it("Should return correct active campaigns count", async function () {
      expect(await crowdfundingPlatform.getActiveCampaignsCount()).to.equal(0);

      await crowdfundingPlatform.createCampaign(
        "Test Campaign 1",
        "Test Description",
        addr1.address,
        ethers.parseEther("1"),
        86400
      );

      expect(await crowdfundingPlatform.getActiveCampaignsCount()).to.equal(1);

      await crowdfundingPlatform.createCampaign(
        "Test Campaign 2",
        "Test Description",
        addr2.address,
        ethers.parseEther("2"),
        86400
      );

      expect(await crowdfundingPlatform.getActiveCampaignsCount()).to.equal(2);
    });
  });

  describe("Owner Functions", function () {
    it("Should allow owner to withdraw leftover funds", async function () {
      await owner.sendTransaction({
        to: await crowdfundingPlatform.getAddress(),
        value: ethers.parseEther("1")
      });

      const initialBalance = await ethers.provider.getBalance(owner.address);
      
      await crowdfundingPlatform.withdrawLeftoverFunds();

      const finalBalance = await ethers.provider.getBalance(owner.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("Should not allow non-owners to withdraw funds", async function () {
      await expect(crowdfundingPlatform.connect(addr1).withdrawLeftoverFunds())
        .to.be.revertedWith("Only the contract owner can call this function");
    });

    it("Should allow owner to transfer ownership", async function () {
      await crowdfundingPlatform.transferOwnership(addr1.address);
      expect(await crowdfundingPlatform.owner()).to.equal(addr1.address);
    });

    it("Should not allow non-owners to transfer ownership", async function () {
      await expect(crowdfundingPlatform.connect(addr1).transferOwnership(addr2.address))
        .to.be.revertedWith("Only the contract owner can call this function");
    });
  });


  describe("Fallback Function", function () {
    beforeEach(async function () {
      CrowdfundingPlatform = await ethers.getContractFactory("CrowdfundingPlatform");
      crowdfundingPlatform = await CrowdfundingPlatform.deploy();
      await crowdfundingPlatform.waitForDeployment();
    });

    it("Should emit event when receiving direct payment", async function () {
      await expect(owner.sendTransaction({
        to: await crowdfundingPlatform.getAddress(),
        value: ethers.parseEther("1")
      })).to.emit(crowdfundingPlatform, "DirectPaymentReceived")
        .withArgs(owner.address, ethers.parseEther("1"));
    });
  });
});