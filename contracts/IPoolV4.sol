// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

interface IPoolV4 {

    // View functions

    function totalValue() external view returns(uint);
    function riskAssetValue() external view returns(uint);
    function stableAssetValue() external view returns(uint);
    function portfolioValue(address addr) external view returns (uint);
    function feesForWithdraw(uint lpToWithdraw, address account) external view returns (uint);
    function lpTokensValue (uint lpTokens) external view returns (uint);

    // Transactional functions
    function deposit(uint amount) external;
    function withdrawLP(uint amount) external;

    // Only Owner functions
    function setFeesPerc(uint feesPerc) external;
    function setSlippageThereshold(uint slippage) external;
    function setStrategy(address strategyAddress) external;
    function setUpkeepInterval(uint upkeepInterval) external;
    function collectFees(uint amount) external;
}