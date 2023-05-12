//SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.14;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./IPoolV4.sol";
import "./IndexLPToken.sol";
import "./IDAOTokenFarm.sol";


contract IndexV4 is Ownable {

    event Deposited(address indexed user, uint amount);
    event Withdrawn(address indexed user, uint amount);

    IERC20Metadata immutable public depositToken;
    IndexLPToken immutable public lpToken;

    uint public totalDeposited = 0;
    uint public totalWithdrawn = 0;

    // depositToken token balances
    mapping (address => uint) public deposits;
    mapping (address => uint) public withdrawals;
    mapping (address => UserInfo[]) public userInfos;

    // users that deposited depositToken tokens into their balances
    address[] public users;
    mapping (address => bool) usersMap;

    IDAOTokenFarm public daoTokenFarm;
    uint8 immutable feesPercDecimals = 4;


    enum UserOperation {
        NONE,
        DEPOSIT,
        WITHDRAWAL
    }

    struct PoolInfo {
        string name;
        address poolAddress;
        address lpTokenAddress;
        uint8 weight;
    }

    struct UserInfo {
        uint256 timestamp;
        UserOperation operation;
        uint256 amount;
    }

    PoolInfo[] public pools;
    uint public totalWeights;


    /**
     * Contract initialization.
     */
    constructor(address _depositTokenAddress, address _lpTokenAddress) {
        depositToken = IERC20Metadata(_depositTokenAddress);
        lpToken = IndexLPToken(_lpTokenAddress);
    }


    function getPoolsInfo() public view returns (PoolInfo[] memory) {
        return pools;
    }


    function getUsers() public view returns (address[] memory) {
        return users;
    }

    function getUserInfos(address account) external view returns (UserInfo[] memory) {
        return userInfos[account];
    }
  
    function lpTokensValue (uint lpTokens) public view returns (uint) {
        // the value of 'lpTokens' (Index LP tokens) is the share of the value of the Index  
        return lpToken.totalSupply() > 0 ? this.totalValue() * lpTokens / lpToken.totalSupply() : 0;
    }


    function gainsPerc(address account) public view returns (uint) {
        // if the address has no deposits (e.g. LPs were transferred from original depositor)
        // then consider the entire LP value as gains.
        // This is to prevent tax avoidance by withdrawing the LPs to different addresses
        if (deposits[account] == 0) return 10 ** uint(feesPercDecimals); // 100% gains

        //  account for staked LPs
        uint stakedLP = address(daoTokenFarm) != address(0) ? daoTokenFarm.getStakedBalance(account, address(lpToken)) : 0;
        uint valueInPool = lpTokensValue(lpToken.balanceOf(account) + stakedLP);

        // check if accounts is in gain
        bool hasGains =  withdrawals[account] + valueInPool > deposits[account];

        // return the fees on the gains or 0 if there are no gains
        return hasGains ? 10 ** uint(feesPercDecimals) * ( withdrawals[account] + valueInPool - deposits[account] ) / deposits[account] : 0;
    }
   


    // Return the total value held of the Index
    function totalValue() public view returns(uint) {
        uint total;
        for (uint i=0; i<pools.length; i++) {
            PoolInfo memory pool = pools[i];
            if (pool.poolAddress != address(0x0)) {
                total += IPoolV4(pool.poolAddress).portfolioValue(address(this));
            }
        }

        return total;
    }


    // Return the value held in this Index for the account provided
    function portfolioValue(address _addr) public view returns(uint) {
        
        return lpToken.totalSupply() == 0 ? 0 : totalValue() * lpToken.balanceOf(_addr) / lpToken.totalSupply();
    }
    
    
    // Deposit the given 'amount' of deposit tokens (e.g USDC) into the Index.
    // These funds get deposited into the pools in this Index according to each pool's weight.
    // Users receive Index LP tokens proportionally to their share of the value currently held in the Index

    function deposit(uint256 amount) external {

        if (amount == 0) return;

        // remember addresses that deposited tokens
        deposits[msg.sender] += amount;
        totalDeposited += amount;

        if (!usersMap[msg.sender]) {
            usersMap[msg.sender] = true;
            users.push(msg.sender);
        }

        userInfos[msg.sender].push(
            UserInfo({
                timestamp: block.timestamp,
                operation: UserOperation.DEPOSIT,
                amount: amount
            })
        );

        // move deposit tokens in the Index
        depositToken.transferFrom(msg.sender, address(this), amount);

        // the value in the pools before this deposit
        uint valueBefore = totalPoolsValue();

        // allocate the deposit to the pools
        uint remainingAmount = amount;
        for (uint i=0; i<pools.length; i++) {
            PoolInfo memory pool = pools[i];
            if (pool.poolAddress != address(0x0)) {
                uint allocation = (i < pools.length-1) ? amount * pool.weight / totalWeights : remainingAmount;
                remainingAmount -= allocation;
                uint lpReceived = allocateToPool(pool, allocation);
                require(lpReceived > 0, "IndexV4: Invalid LP amount received");
            }
        }

        // the value in the pools after this deposit
        uint valueAfter = totalPoolsValue();

        // calculate lptokens for this deposit based on the value added to all pools
        uint lpToMint = lpTokensForDeposit(valueAfter - valueBefore);
      
        // mint lp tokens to the user
        lpToken.mint(msg.sender, lpToMint);

        emit Deposited(msg.sender, amount);
    }


   function withdrawAll() external {
        _withdrawLP(lpToken.balanceOf(msg.sender));
    }

    function withdrawLP(uint256 lpAmount) external {
        _withdrawLP(lpAmount);
    }

   function _withdrawLP(uint256 amount) internal {
        if (amount == 0) return;
        
        require(amount <= lpToken.balanceOf(msg.sender), "IndexV4: LP balance exceeded");
  
        // 1. calculate percentage of LP being withdrawn
        uint precision = 10 ** uint(lpToken.decimals());
        uint withdrawnPerc = precision * amount / lpToken.totalSupply();
        bool isWithdrawAll = (amount == lpToken.totalSupply());

        // 2. then burn the LP for this withdrawal
        lpToken.burn(msg.sender, amount);

        uint depositTokenBalanceBefore = depositToken.balanceOf(address(this));

        // 3. for each pool in the index withdraw the % of LP
        for (uint i=0; i<pools.length; i++) {
            PoolInfo memory pool = pools[i];
            if (pool.lpTokenAddress != address(0x0)) {
                uint indexBalance = IERC20(pool.lpTokenAddress).balanceOf(address(this));
                uint withdrawAmount = isWithdrawAll ? indexBalance : withdrawnPerc * indexBalance / precision;

                IPoolV4(pool.poolAddress).withdrawLP(withdrawAmount);
            }
        }

        uint amountToWithdraw = depositToken.balanceOf(address(this)) - depositTokenBalanceBefore;
        require (amountToWithdraw > 0, "Amount withdrawn is 0");

        // 4. remember tokens withdrawn
        withdrawals[msg.sender] += amountToWithdraw;
        totalWithdrawn += amountToWithdraw;

        userInfos[msg.sender].push(
            UserInfo({
                timestamp: block.timestamp,
                operation: UserOperation.WITHDRAWAL,
                amount: amountToWithdraw
            })
        );

        // 5. transfer the amount of tokens withdrawn to the user
        depositToken.transfer(msg.sender, amountToWithdraw);

        emit Withdrawn(msg.sender, amountToWithdraw);
    }


    /**
     * Returns the fees, in LP tokens, that an account would pay to withdraw 'lpTokenAmount' LP tokens
     */
    function feesForWithdraw(uint lpTokenAmount, address account) public view returns (uint) {

        if (lpTokenAmount == 0 || lpToken.totalSupply() == 0) return 0;

        // calculate percentage of LP being withdrawn
        uint lpToWithdraw = lpTokenAmount < lpToken.balanceOf(account) ? lpTokenAmount : lpToken.balanceOf(account);

        uint precision = 10 ** uint(lpToken.decimals());
        uint withdrawnPerc = precision * lpToWithdraw / lpToken.totalSupply();
        bool isWithdrawingAll = (lpToWithdraw >= lpToken.totalSupply());

        // sum up expected fees value (in stable asset) across all pools in the Index
        uint feesValue;
        for (uint i=0; i<pools.length; i++) {
            PoolInfo memory pool = pools[i];
            if (pool.poolAddress != address(0x0) && pool.lpTokenAddress != address(0x0)) {

                // the LP balance of the index with a pool
                uint indexBalance = IERC20(pool.lpTokenAddress).balanceOf(address(this));
                // the amount to withdraw from the pool is the percentage of Pool LP held by the Index
                uint withdrawAmount = isWithdrawingAll ? indexBalance : withdrawnPerc * indexBalance / precision;
                uint feesLP = IPoolV4(pool.poolAddress).feesForWithdraw(withdrawAmount, address(this));

                feesValue += IPoolV4(pool.poolAddress).lpTokensValue(feesLP);
            }
        }

        uint lpValue = this.lpTokensValue(lpToWithdraw);

        // lpFees / lpToWithdraw = feesValue / lpValue
        // lpFees := lpToWithdraw * feesValue / lpValue 
        uint lpFees = lpToWithdraw * feesValue / lpValue;

        return lpFees;
    }




    //// ONLY OWNER FUNCTIONS ////
    function addPool(string memory _name, address _pool, address _lpToken, uint8 weight) external onlyOwner {
        PoolInfo memory pool = PoolInfo({
            name: _name,
            poolAddress: _pool,
            lpTokenAddress: _lpToken,
            weight: weight
        });

        pools.push(pool);
        totalWeights += pool.weight;
    }

    function removePool(uint index) external onlyOwner {
        PoolInfo memory pool = pools[index];
        totalWeights -= pool.weight;

        delete pools[index];
    }

    function setFarmAddress(address _farmAddress) public onlyOwner {
        daoTokenFarm = IDAOTokenFarm(_farmAddress);
    }

    //// INTERNAL FUNCTIONS ////

    // Return the value of all pools in the Index
    function totalPoolsValue() public view returns(uint) {
        uint total;
        for (uint i=0; i<pools.length; i++) {
            PoolInfo memory pool = pools[i];
            if (pool.poolAddress != address(0x0)) {
                total += IPoolV4(pool.poolAddress).totalValue();
            }
        }

        return total;
    }

    // Returns the Index LP tokens representing the % of the value of the 'amount' deposited
    // with respect to the total value of this Index
    function lpTokensForDeposit(uint amount) internal view returns (uint) {
        
        uint depositLPTokens;
        if (lpToken.totalSupply() == 0) {
            // If first deposit => allocate the inital LP tokens amount to the user
            depositLPTokens = amount;
        } else {
            // if already have allocated LP tokens => calculate the additional LP tokens for this deposit
            // calculate portfolio % of the deposit (using 'precision' digits)
            uint precision = 10**uint(lpToken.decimals());
            uint depositPercentage = precision * amount / totalValue();

            // calculate the amount of LP tokens for the deposit so that they represent 
            // a % of the existing LP tokens equivalent to the % value of this deposit to the sum of all pools value.
            // 
            // X := P * T / (1 - P)  
            //      X: additinal LP toleks to allocate to the user to account for this deposit
            //      P: Percentage of pools value accounted by this deposit
            //      T: total LP tokens allocated before this deposit
    
            depositLPTokens = (depositPercentage * lpToken.totalSupply()) / ((1 * precision) - depositPercentage);
        }

        return depositLPTokens;
    }



    // Deposit 'amount' into 'pool' and returns the pool LP tokens received
    function allocateToPool(PoolInfo memory pool, uint amount) internal returns (uint) {
        IERC20 pooLP = IERC20(pool.lpTokenAddress);
        uint lpBalanceBefore = pooLP.balanceOf(address(this));

        // deposit into the pool
        depositToken.approve(pool.poolAddress, amount);
        IPoolV4(pool.poolAddress).deposit(amount);

        // return the LP tokens received
        return pooLP.balanceOf(address(this)) - lpBalanceBefore;
    }

}