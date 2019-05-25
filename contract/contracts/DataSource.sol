pragma solidity 0.5.8;

interface DataSource {
  function getQueryPrice() external view returns (uint256);
  function getAsBool(bytes32 key) external payable returns (bool);
}