// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./Interfaces.sol";

/**
 * @title EventTicketNFT
 * @dev NFT contract for minting and managing tickets
 */
contract EventTicketNFT is ERC721, ERC721URIStorage, ERC721Enumerable, IERC2981, Ownable, ReentrancyGuard {
    address public eventContract;
    uint256 public constant ROYALTY_FEE = 500; // 5%
    uint256 private _tokenIdCounter;
    
    struct Ticket {
        uint256 tokenId;
        address originalBuyer;
        uint256 mintedAt;
        uint256 categoryId;
        bool isUsed;
    }
    
    mapping(uint256 => Ticket) public tickets;
    mapping(uint256 => bool) public usedTickets;
    
    event TicketMinted(uint256 indexed tokenId, address indexed buyer, uint256 categoryId);
    event TicketUsed(uint256 indexed tokenId);
    
    modifier onlyEventContract() {
        require(msg.sender == eventContract, "Only event contract");
        _;
    }
    
    constructor(
        string memory _name,
        string memory _symbol,
        address _eventContract,
        address _owner
    ) ERC721(_name, _symbol) Ownable(_owner) {
        eventContract = _eventContract;
    }
    
    function mintTicket(
        address to,
        string memory _tokenURI,
        uint256 categoryId
    ) external onlyEventContract returns (uint256) {
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, _tokenURI);
        
        tickets[tokenId] = Ticket({
            tokenId: tokenId,
            originalBuyer: to,
            mintedAt: block.timestamp,
            categoryId: categoryId,
            isUsed: false
        });
        
        emit TicketMinted(tokenId, to, categoryId);
        return tokenId;
    }
    
    function batchMintTickets(
        address to,
        string[] memory _tokenURIs,
        uint256[] memory categoryIds,
        uint256[] memory quantities
    ) public onlyEventContract returns (uint256[] memory) {
        require(_tokenURIs.length > 0 && _tokenURIs.length <= 10, "Invalid quantity");
        require(_tokenURIs.length == quantities.length, "URI and quantity count mismatch");
        require(_tokenURIs.length == categoryIds.length, "Category count mismatch");
        
        // Calculate total number of tickets to mint
        uint256 totalTickets;
        for (uint256 i = 0; i < quantities.length; i++) {
            unchecked {
                totalTickets += quantities[i];
            }
        }
        
        uint256[] memory tokenIds = new uint256[](totalTickets);
        uint256 currentTokenIndex;
        
        // For each category
        for (uint256 i = 0; i < _tokenURIs.length; i++) {
            string memory uri = _tokenURIs[i];
            uint256 categoryId = categoryIds[i];
            uint256 quantity = quantities[i];
            
            // Mint the specified quantity for this category
            for (uint256 j = 0; j < quantity; j++) {
                uint256 tokenId = _tokenIdCounter;
                unchecked {
                    _tokenIdCounter++;
                }
                
                _safeMint(to, tokenId);
                _setTokenURI(tokenId, uri);
                
                tickets[tokenId] = Ticket({
                    tokenId: tokenId,
                    originalBuyer: to,
                    mintedAt: block.timestamp,
                    categoryId: categoryId,
                    isUsed: false
                });
                
                tokenIds[currentTokenIndex] = tokenId;
                unchecked {
                    currentTokenIndex++;
                }
                emit TicketMinted(tokenId, to, categoryId);
            }
        }
        
        return tokenIds;
    }
    
    // Purchase functions
    function purchaseSingleTicket(string memory uri, uint256 quantity) external payable returns (uint256[] memory) {
        require(msg.sender == tx.origin, "Only EOA can purchase tickets");
        require(msg.value > 0, "Payment amount must be greater than 0");
        require(quantity > 0, "Quantity must be greater than 0");
        require(quantity <= 100, "Quantity cannot exceed 100 tickets");
        
        // Get event contract
        address eventContractAddress = eventContract;
        require(eventContractAddress != address(0), "Event contract not set");
        
        // Get event contract instance
        IEventContract eventContractInstance = IEventContract(eventContractAddress);
        
        // Check event state before purchase
        require(eventContractInstance.isActive(), "Event is not active");
        require(block.timestamp >= eventContractInstance.salesStartTime(), "Sales have not started");
        require(block.timestamp <= eventContractInstance.salesEndTime(), "Sales have ended");
        
        // Calculate expected payment
        uint256 expectedPayment = eventContractInstance.ticketPrice() * quantity;
        require(msg.value >= expectedPayment, "Insufficient payment amount");
        
        // Purchase tickets through event contract
        try eventContractInstance.purchaseSingleTicket{value: msg.value}(msg.sender, quantity) {
            // Mint NFTs
            uint256[] memory tokenIds = new uint256[](quantity);
            
            for (uint256 i = 0; i < quantity; i++) {
                uint256 tokenId = _tokenIdCounter;
                unchecked {
                    _tokenIdCounter++;
                }
                
                _safeMint(msg.sender, tokenId);
                _setTokenURI(tokenId, uri);
                
                tickets[tokenId] = Ticket({
                    tokenId: tokenId,
                    originalBuyer: msg.sender,
                    mintedAt: block.timestamp,
                    categoryId: 0, // Default category
                    isUsed: false
                });
                
                tokenIds[i] = tokenId;
                emit TicketMinted(tokenId, msg.sender, 0);
            }
            
            return tokenIds;
        } catch Error(string memory reason) {
            revert(string(abi.encodePacked("Event contract purchase failed: ", reason)));
        } catch {
            revert("Event contract purchase failed without reason");
        }
    }
    
    function purchaseCategoryTickets(
        uint256[] memory quantities,
        uint256[] memory categoryIds,
        string[] memory uris
    ) external payable returns (uint256[] memory) {
        require(msg.sender == tx.origin, "Only EOA");
        require(msg.value > 0, "Payment required");
        require(quantities.length > 0 && quantities.length <= 10, "Invalid quantity");
        require(quantities.length == categoryIds.length, "Array length mismatch");
        require(quantities.length == uris.length, "Array length mismatch");
        
        // Get event contract
        address eventContractAddress = eventContract;
        require(eventContractAddress != address(0), "Event contract not set");
        
        // Purchase tickets through event contract
        IEventContract(eventContractAddress).purchaseCategoryTickets{value: msg.value}(
            msg.sender,
            quantities,
            categoryIds
        );
        
        // Calculate total tickets to mint
        uint256 totalTickets;
        for (uint256 i = 0; i < quantities.length; i++) {
            unchecked {
                totalTickets += quantities[i];
            }
        }
        
        // Mint NFTs
        uint256[] memory tokenIds = new uint256[](totalTickets);
        uint256 currentTokenIndex;
        
        for (uint256 i = 0; i < quantities.length; i++) {
            string memory uri = uris[i];
            uint256 categoryId = categoryIds[i];
            uint256 quantity = quantities[i];
            
            for (uint256 j = 0; j < quantity; j++) {
                uint256 tokenId = _tokenIdCounter;
                unchecked {
                    _tokenIdCounter++;
                }
                
                _safeMint(msg.sender, tokenId);
                _setTokenURI(tokenId, uri);
                
                tickets[tokenId] = Ticket({
                    tokenId: tokenId,
                    originalBuyer: msg.sender,
                    mintedAt: block.timestamp,
                    categoryId: categoryId,
                    isUsed: false
                });
                
                tokenIds[currentTokenIndex] = tokenId;
                unchecked {
                    currentTokenIndex++;
                }
                emit TicketMinted(tokenId, msg.sender, categoryId);
            }
        }
        
        return tokenIds;
    }
    
    function useTicket(uint256 tokenId) external {
        require(ownerOf(tokenId) != address(0), "Token not exist");
        require(!tickets[tokenId].isUsed, "Already used");
        
        IEventContract eventCtrl = IEventContract(eventContract);
        require(
            msg.sender == eventCtrl.organizer() || msg.sender == owner(),
            "Not authorized"
        );
        
        tickets[tokenId].isUsed = true;
        usedTickets[tokenId] = true;
        
        emit TicketUsed(tokenId);
    }
    
    function royaltyInfo(uint256 _tokenId, uint256 _salePrice)
        external
        view
        override
        returns (address, uint256)
    {
        require(ownerOf(_tokenId) != address(0), "Token not exist");
        
        IEventContract eventCtrl = IEventContract(eventContract);
        address organizer = eventCtrl.organizer();
        uint256 royaltyAmount = (_salePrice * ROYALTY_FEE) / 10000;
        
        return (organizer, royaltyAmount);
    }
    
    // View functions
    function getTicket(uint256 tokenId) external view returns (Ticket memory) {
        require(ownerOf(tokenId) != address(0), "Token not exist");
        return tickets[tokenId];
    }
    
    function getTicketsOfOwner(address owner) external view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](tokenCount);
        
        for (uint256 i = 0; i < tokenCount; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(owner, i);
        }
        
        return tokenIds;
    }
    
    function isTicketUsed(uint256 tokenId) external view returns (bool) {
        return tickets[tokenId].isUsed;
    }
    
    // Required overrides
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage) 
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, ERC721Enumerable, IERC165)
        returns (bool)
    {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }

    function _update(address to, uint256 tokenId, address auth) 
        internal 
        virtual 
        override(ERC721, ERC721Enumerable) 
        returns (address) 
    {
        if (to == address(0)) {
            delete tickets[tokenId];
            delete usedTickets[tokenId];
        }
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        virtual
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }
}