// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CrowdfundingPlatform is ReentrancyGuard {

    // Struct to hold details of each campaign
    struct Campaign {
        string title; 
        string description; 
        address payable benefactor; 
        uint256 goal; 
        uint256 deadline; 
        uint256 amountRaised; 
        bool ended; 
    }

    uint256 private campaignCounter; 
    mapping(uint256 => Campaign) public campaigns; 
    address public owner; 

    // Events to log important actions
    event CampaignCreated(uint256 campaignId, string title, address benefactor, uint256 goal, uint256 deadline);
    event DonationReceived(uint256 campaignId, address donor, uint256 amount);
    event CampaignEnded(uint256 campaignId, uint256 amountRaised, bool goalReached);
    event DirectPaymentReceived(address indexed sender, uint256 amount);

    // Modifier to restrict function access to the contract owner
    modifier onlyOwner() {
        require(msg.sender == owner, "Only the contract owner can call this function");
        _;
    }

    // Modifier to check if a campaign is active
    modifier campaignActive(uint256 _campaignId) {
        require(_campaignId > 0 && _campaignId <= campaignCounter, "Invalid campaign ID");
        require(block.timestamp < campaigns[_campaignId].deadline, "Campaign has ended");
        require(!campaigns[_campaignId].ended, "Campaign has already been finalized");
        _;
    }

    // Constructor to set the contract owner and initialize the campaign counter
    constructor() {
        owner = msg.sender;
        campaignCounter = 0;
    }

    // Function to create a new campaign
    function createCampaign(
        string memory _title,
        string memory _description,
        address payable _benefactor,
        uint256 _goal,
        uint256 _durationInSeconds
    ) public returns (uint256) {
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(bytes(_description).length > 0, "Description cannot be empty");
        require(_benefactor != address(0), "Invalid benefactor address");
        require(_goal > 0, "Goal must be greater than zero");
        require(_durationInSeconds > 0, "Duration must be greater than zero");

        // Increment the campaign counter for each new campaign
        campaignCounter = campaignCounter + 1;

        // Set the campaign deadline based on the current time and duration provided
        uint256 deadline = block.timestamp + _durationInSeconds;

        // Store the new campaign in the mapping
        campaigns[campaignCounter] = Campaign({
            title: _title,
            description: _description,
            benefactor: _benefactor,
            goal: _goal,
            deadline: deadline,
            amountRaised: 0,
            ended: false
        });

        // Emit an event to signal that a new campaign has been created
        emit CampaignCreated(campaignCounter, _title, _benefactor, _goal, deadline);

        return campaignCounter;
    }

    // Function to donate to a campaign
    function donateToCampaign(uint256 _campaignId) public payable campaignActive(_campaignId) {
        require(msg.value > 0, "Donation amount must be greater than zero");

        Campaign storage campaign = campaigns[_campaignId];
        campaign.amountRaised = campaign.amountRaised + msg.value;

        emit DonationReceived(_campaignId, msg.sender, msg.value);

        if (campaign.amountRaised >= campaign.goal) {
            endCampaign(_campaignId);
        }
    }

    // Function to end a campaign and transfer funds to the benefactor
    function endCampaign(uint256 _campaignId) public nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];
        require(block.timestamp >= campaign.deadline || campaign.amountRaised >= campaign.goal, "Campaign cannot be ended yet");
        require(!campaign.ended, "Campaign has already been ended");

        campaign.ended = true;
        bool goalReached = campaign.amountRaised >= campaign.goal;

        if (campaign.amountRaised > 0) {
            campaign.benefactor.transfer(campaign.amountRaised);
        }

        emit CampaignEnded(_campaignId, campaign.amountRaised, goalReached);
    }

    // Function to get details of a specific campaign
    function getCampaignDetails(uint256 _campaignId) public view returns (
        string memory title,
        string memory description,
        address benefactor,
        uint256 goal,
        uint256 deadline,
        uint256 amountRaised,
        bool ended
    ) {
        require(_campaignId > 0 && _campaignId <= campaignCounter, "Invalid campaign ID");
        Campaign storage campaign = campaigns[_campaignId];
        return (
            campaign.title,
            campaign.description,
            campaign.benefactor,
            campaign.goal,
            campaign.deadline,
            campaign.amountRaised,
            campaign.ended
        );
    }

    // Function to count how many campaigns are currently active
    function getActiveCampaignsCount() public view returns (uint256) {
        uint256 activeCount = 0;
        // Loop through all campaigns to count those that are active
        for (uint256 i = 1; i <= campaignCounter; i++) {
            if (!campaigns[i].ended && block.timestamp < campaigns[i].deadline) {
                activeCount++;
            }
        }
        return activeCount; 
    }

    // Function for the contract owner to withdraw any leftover funds in the contract
    function withdrawLeftoverFunds() public onlyOwner nonReentrant {
        uint256 contractBalance = address(this).balance;
        require(contractBalance > 0, "No funds to withdraw");

        // Transfer the contract balance to the owner
        (bool success, ) = owner.call{value: contractBalance}("");
        require(success, "Transfer failed");
    }

    // Function to change the contract owner
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner cannot be the zero address");
        owner = newOwner; // Update the owner to the new address
    }

    // Fallback function to handle direct Ether transfers to the contract
    receive() external payable {
    emit DirectPaymentReceived(msg.sender, msg.value);
}
}
