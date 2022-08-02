// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

interface IPoolV3 {
    function totalValue() external view returns(uint);
    function riskAssetValue() external view returns(uint);
    function stableAssetValue() external view returns(uint);
    function portfolioValue(address _addr) external view returns (uint);
    function feesForWithdraw(uint lpToWithdraw, address account) external view returns (uint);
    function lpTokensValue (uint lpTokens) external view returns (uint);

    function deposit(uint amount) external;
    function withdrawLP(uint amount) external;
}