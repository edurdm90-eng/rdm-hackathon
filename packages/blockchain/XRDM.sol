// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract XRDM is ERC1155, Ownable, ReentrancyGuard {
    // Multi-minter authorization — multiple implementation contracts (Edu, Corporate, ...) can mint.
    mapping(address => bool) public isAuthorizedMinter;

    mapping(uint256 => uint256) public totalSupply;
    mapping(address => uint256) public teamMemberTotalBalance;
    mapping(uint256 => string) private _tokenURIs;

    event AuthorizedMinterAdded(address indexed minter);
    event AuthorizedMinterRemoved(address indexed minter);
    event SoulboundTokenMinted(
        address indexed teamMember,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 assignmentId
    );
    event TokenURISet(uint256 indexed tokenId, string uri);

    error NotTeamLeaderAssignmentContract();
    error SoulboundTokenNotTransferable();
    error InvalidAddress();


    constructor(string memory uri_) ERC1155(uri_) Ownable(msg.sender) {
        // Constructor sets owner
    }

    function addAuthorizedMinter(address _minter) external onlyOwner {
        if (_minter == address(0)) revert InvalidAddress();
        isAuthorizedMinter[_minter] = true;
        emit AuthorizedMinterAdded(_minter);
    }

    function removeAuthorizedMinter(address _minter) external onlyOwner {
        isAuthorizedMinter[_minter] = false;
        emit AuthorizedMinterRemoved(_minter);
    }

    // Override uri to return per-token URI if set, else fallback to base URI
    function uri(uint256 tokenId) public view override returns (string memory) {
        string memory tokenURI = _tokenURIs[tokenId];
        if (bytes(tokenURI).length > 0) {
            return tokenURI;
        }
        return super.uri(tokenId);
    }

    // Set per-token URI — callable only by an authorized minter
    function setTokenURI(uint256 tokenId, string calldata tokenURI) external {
        if (!isAuthorizedMinter[msg.sender]) revert NotTeamLeaderAssignmentContract();
        _tokenURIs[tokenId] = tokenURI;
        emit TokenURISet(tokenId, tokenURI);
    }

    function mintSoulboundToken(
        address teamMember,
        uint256 tokenId,
        uint256 amount,
        uint256 assignmentId
    ) external nonReentrant {
        if (!isAuthorizedMinter[msg.sender]) revert NotTeamLeaderAssignmentContract();
        if (teamMember == address(0)) revert InvalidAddress();
        if (amount == 0) revert();

        _mint(teamMember, tokenId, amount, "");
        totalSupply[tokenId] += amount;
        teamMemberTotalBalance[teamMember] += amount;

        emit SoulboundTokenMinted(teamMember, tokenId, amount, assignmentId);
    }

    // Batch mint soulbound NFTs for Impact Room team goal — 1 per teamMember, shared URI
    function mintBatchSoulboundTokens(
        address[] calldata teamMembers,
        uint256[] calldata tokenIds,
        uint256 roomId,
        string calldata teamNFTURI
    ) external nonReentrant {
        if (!isAuthorizedMinter[msg.sender]) revert NotTeamLeaderAssignmentContract();
        require(teamMembers.length == tokenIds.length, "Length mismatch");
        for (uint256 i = 0; i < teamMembers.length; i++) {
            if (teamMembers[i] == address(0)) revert InvalidAddress();
            _mint(teamMembers[i], tokenIds[i], 1, "");
            totalSupply[tokenIds[i]] += 1;
            teamMemberTotalBalance[teamMembers[i]] += 1;
            _tokenURIs[tokenIds[i]] = teamNFTURI;
        }
        emit SoulboundTokenMinted(teamMembers[0], tokenIds[0], 1, roomId);
    }

    // Batch mint soulbound tokens with varying amounts per teamMember
    function mintBatchSoulboundTokensWithAmounts(
        address[] calldata teamMembers,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        uint256 roomId
    ) external nonReentrant {
        if (!isAuthorizedMinter[msg.sender]) revert NotTeamLeaderAssignmentContract();
        require(teamMembers.length == tokenIds.length && teamMembers.length == amounts.length, "Length mismatch");
        for (uint256 i = 0; i < teamMembers.length; i++) {
            if (teamMembers[i] == address(0)) revert InvalidAddress();
            if (amounts[i] == 0) revert();
            _mint(teamMembers[i], tokenIds[i], amounts[i], "");
            totalSupply[tokenIds[i]] += amounts[i];
            teamMemberTotalBalance[teamMembers[i]] += amounts[i];
            emit SoulboundTokenMinted(teamMembers[i], tokenIds[i], amounts[i], roomId);
        }
    }

    function safeTransferFrom(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public pure override {
        revert SoulboundTokenNotTransferable();
    }

    function safeBatchTransferFrom(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public pure override {
        revert SoulboundTokenNotTransferable();
    }

    function getTeamMemberTotalBalance(address teamMember) external view returns (uint256) {
        return teamMemberTotalBalance[teamMember];
    }

    function getTeamMemberTokenBalance(address teamMember, uint256 tokenId) external view returns (uint256) {
        return balanceOf(teamMember, tokenId);
    }

    function batchGetBalances(
        address[] memory teamMembers,
        uint256[] memory tokenIds
    ) external view returns (uint256[] memory balances) {
        require(teamMembers.length == tokenIds.length, "Length mismatch");
        balances = new uint256[](teamMembers.length);
        for (uint256 i = 0; i < teamMembers.length; i++) {
            balances[i] = balanceOf(teamMembers[i], tokenIds[i]);
        }
    }

    function setURI(string memory newuri) external onlyOwner {
        _setURI(newuri);
    }
}
