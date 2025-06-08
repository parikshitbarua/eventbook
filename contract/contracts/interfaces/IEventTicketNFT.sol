// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IEventTicketNFT
 * @dev Interface for EventTicketNFT contract
 */
interface IEventTicketNFT {
    // Structs
    struct Ticket {
        uint256 tokenId;
        address originalBuyer;
        uint256 mintedAt;
        uint256 categoryId;
        bool isUsed;
    }
    
    // Events
    event TicketMinted(uint256 indexed tokenId, address indexed buyer, uint256 categoryId);
    event TicketUsed(uint256 indexed tokenId);
    
    // View functions
    function ROYALTY_FEE() external view returns (uint256);
    function eventContract() external view returns (address);
    function tickets(uint256 tokenId) external view returns (Ticket memory);
    function usedTickets(uint256 tokenId) external view returns (bool);
    function getTicket(uint256 tokenId) external view returns (Ticket memory);
    function getTicketsOfOwner(address owner) external view returns (uint256[] memory);
    function isTicketUsed(uint256 tokenId) external view returns (bool);
    
    // ERC721 functions (inherited)
    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function tokenURI(uint256 tokenId) external view returns (string memory);
    function totalSupply() external view returns (uint256);
    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256);
    
    // State-changing functions
    function mintTicket(address to, string memory tokenURI, uint256 categoryId) external returns (uint256);
    function batchMintTickets(address to, string[] memory tokenURIs, uint256 categoryId) external returns (uint256[] memory);
    function purchaseTickets(uint256 quantity, uint256 categoryId, string[] memory tokenURIs) external payable returns (uint256[] memory);
    function useTicket(uint256 tokenId) external;
    
    // Royalty function
    function royaltyInfo(uint256 tokenId, uint256 salePrice) external view returns (address, uint256);
} 