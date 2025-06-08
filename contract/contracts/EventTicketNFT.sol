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
        uint256 categoryId
    ) public onlyEventContract returns (uint256[] memory) {
        require(_tokenURIs.length > 0 && _tokenURIs.length <= 10, "Invalid quantity");
        
        uint256[] memory tokenIds = new uint256[](_tokenURIs.length);
        
        for (uint256 i = 0; i < _tokenURIs.length; i++) {
            uint256 tokenId = _tokenIdCounter;
            _tokenIdCounter++;
            
            _safeMint(to, tokenId);
            _setTokenURI(tokenId, _tokenURIs[i]);
            
            tickets[tokenId] = Ticket({
                tokenId: tokenId,
                originalBuyer: to,
                mintedAt: block.timestamp,
                categoryId: categoryId,
                isUsed: false
            });
            
            tokenIds[i] = tokenId;
            emit TicketMinted(tokenId, to, categoryId);
        }
        
        return tokenIds;
    }
    
    function purchaseTickets(
        uint256 quantity,
        uint256 categoryId,
        string[] memory _tokenURIs
    ) external payable nonReentrant returns (uint256[] memory) {
        require(_tokenURIs.length == quantity, "URI count mismatch");
        
        IEventContract(eventContract).purchaseTickets{value: msg.value}(
            msg.sender,
            quantity,
            categoryId
        );
        
        return batchMintTickets(msg.sender, _tokenURIs, categoryId);
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