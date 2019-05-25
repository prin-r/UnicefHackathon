pragma solidity 0.5.8;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract MockIdentityProvider is Ownable {

  uint256 public queryPrice = 0;
  mapping (bytes32 => bool) public identities;

  function addMe() public {
    identities[bytes32(bytes20(msg.sender))] = true;
  }

  function addr2B32(address addr) public pure returns(bytes32) {
      return bytes32(bytes20(addr));
  }

  function getAsBool(bytes32 key) public payable returns(bool) {
    return identities[key];
  }

  function setQueryPrice(uint256 _queryPrice) public onlyOwner {
    queryPrice = _queryPrice;
  }

  function getQueryPrice() external view returns (uint256) {
    return queryPrice;
  }
}
