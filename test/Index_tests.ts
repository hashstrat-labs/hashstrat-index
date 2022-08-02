import { expect } from "chai";
import { constants, utils, Contract  } from "ethers"
import { ethers, network } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { fromUsdc, round } from "./helpers"

import abis from "./abis/abis.json";

const poolOwner = '0x4F888d90c31c97efA63f0Db088578BB6F9D1970C'
const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const usdcSource = '0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245' // rich account owing 48,354,222.149244  USDC


describe("Index contract", function () {

  // We define a fixture to reuse the same setup in every test. We use
  // loadFixture to run this setup once, snapshot that state, and reset Hardhat
  // Network to that snapshopt in every test.
  async function deployIndexV3Fixture() {

    // Get the ContractFactory and Signers here.
    const MultiPool = await ethers.getContractFactory("IndexV3");
    const MultiPoolLPToken = await ethers.getContractFactory("IndexLPToken");

    const [owner, addr1, addr2] = await ethers.getSigners();

    const multiPoolLPToken = await MultiPoolLPToken.deploy("Index LP Token", "IndexLP", 6)
    await multiPoolLPToken.deployed()

    const multiPool = await MultiPool.deploy(usdcAddress, multiPoolLPToken.address);
    await multiPool.deployed();

    // add minter
    await multiPoolLPToken.addMinter(multiPool.address)

    const usdc = new Contract(usdcAddress, abis["erc20"], ethers.provider)

    const pool1 = new Contract(pools.pool01.address, abis["poolV3"], ethers.provider)
    const pool2 = new Contract(pools.pool02.address, abis["poolV3"], ethers.provider)
    const pool3 = new Contract(pools.pool03.address, abis["poolV3"], ethers.provider)

    await emptyPool(pool1.address)
    await emptyPool(pool2.address)
    await emptyPool(pool3.address)

    // burn usd held by accounts
    await usdc.connect(addr1).transfer(usdc.address, await usdc.balanceOf(addr1.address))
    await usdc.connect(addr2).transfer(usdc.address, await usdc.balanceOf(addr2.address))
    await usdc.connect(owner).transfer(usdc.address, await usdc.balanceOf(owner.address))

    // Fixtures can return anything you consider useful for your tests
    return { multiPool, multiPoolLPToken, owner, addr1, addr2, usdc, pool1, pool2, pool3 };
    
  }


  // You can nest describe calls to create subsections.
  describe("Deployment", function () {
    it("Set the right deposit token address", async function () {
      const { multiPool } = await loadFixture(deployIndexV3Fixture);

      expect(await multiPool.depositToken()).to.equal(usdcAddress);
    });

  });


  // describe("Deposit $1000 into Pool02", function () {

  //   it("Should allocate LP tokens to the user and the Index", async function () {
  //     const { multiPool, multiPoolLPToken, owner, usdc } = await loadFixture(deployTokenFixture);

  //     const lptoken = new Contract(pools.pool02.lptoken, abis["erc20"], ethers.provider)
  //     const pool2 = new Contract(pools.pool02.address, abis["poolV2"] , ethers.provider)

  //     // add pool2 (no deposits)
  //     await multiPool.addPool("Pool02", pools.pool02.address, pools.pool02.lptoken, 100)

  //     // transfer usdcs to owner
  //     await transferFunds(1_000 * 10 ** 6, owner.address)

  //     const depositAmount = 1_000 * 10 ** 6
  //     await usdc.connect(owner).approve(multiPool.address, depositAmount)

  //     // deposit funds
  //     await multiPool.deposit(depositAmount);

  //     const totalPoolsValue = await multiPool.totalPoolsValue();

  //     expect( fromUsdc(await usdc.balanceOf(owner.address)) ).to.equal(0);

  //     expect( fromUsdc(await lptoken.balanceOf(multiPool.address)) ).to.equal(1000);

  //     expect( await multiPoolLPToken.balanceOf(owner.address) ).to.equal(totalPoolsValue);

  //     expect( await multiPoolLPToken.totalSupply() ).to.equal(totalPoolsValue);

  //   });

  // })


  describe("Deposit into a non empty Pool", function () {

    it("Should allocate the expected LP tokens when an account deposits an amount that is 'less' than the value in the pool", async function () {
      const { multiPool, multiPoolLPToken, addr1, addr2, usdc } = await loadFixture(deployIndexV3Fixture);

      const lptoken = new Contract(pools.pool02.lptoken, abis["erc20"], ethers.provider)

      // add pool2 (no deposits)
      await multiPool.addPool("Pool02", pools.pool02.address, pools.pool02.lptoken, 100)

      // transfer usdcs to owner
      await transferFunds(3_000 * 10 ** 6, addr1.address)
      await transferFunds(1_000 * 10 ** 6, addr2.address)

       // addr1 deposit funds
      const depositAmount1 = 3_000 * 10 ** 6
      await usdc.connect(addr1).approve(multiPool.address, depositAmount1)
      await multiPool.connect(addr1).deposit(depositAmount1);

      // addr2 deposit funds
      const depositAmount2 = 1_000 * 10 ** 6
      await usdc.connect(addr2).approve(multiPool.address, depositAmount2)
      await multiPool.connect(addr2).deposit(depositAmount2);

      const addr1Balance = await multiPoolLPToken.balanceOf(addr1.address)
      const addr2Balance = await multiPoolLPToken.balanceOf(addr2.address)

      expect( fromUsdc(await usdc.balanceOf(addr2.address)) ).to.equal(0);
      expect( fromUsdc(await lptoken.balanceOf(multiPool.address)) ).to.greaterThan(3990);
      expect( addr1Balance.div(addr2Balance) ).to.equal( 3 );
      expect( addr1Balance ).to.greaterThan(2993);
      expect( addr2Balance ).to.greaterThan(997);
      expect( await multiPoolLPToken.totalSupply() ).to.equal( addr1Balance.add(addr2Balance) );

    });

    
    it("Should allocate the expected LP tokens when an account deposits an amount is 'more' than the value in the pool", async function () {
      const { multiPool, multiPoolLPToken, addr1, addr2, usdc } = await loadFixture(deployIndexV3Fixture);

      const lptoken = new Contract(pools.pool02.lptoken, abis["erc20"], ethers.provider)
      const pool2 = new Contract(pools.pool02.address, abis["poolV3"] , ethers.provider)

      // add pool2 (no deposits)
      await multiPool.addPool("Pool02", pools.pool02.address, pools.pool02.lptoken, 100)

      // transfer usdc to addr1, addr2
      await transferFunds(1_000 * 10 ** 6, addr1.address)
      await transferFunds(3_000 * 10 ** 6, addr2.address)

       // addr1 deposit funds
      const depositAmount1 = 1_000 * 10 ** 6
      await usdc.connect(addr1).approve(multiPool.address, depositAmount1)
      await multiPool.connect(addr1).deposit(depositAmount1);

      // addr2 deposit funds
      const depositAmount2 = 3_000 * 10 ** 6
      await usdc.connect(addr2).approve(multiPool.address, depositAmount2)
      await multiPool.connect(addr2).deposit(depositAmount2);

      const addr1Balance = await multiPoolLPToken.balanceOf(addr1.address)
      const addr2Balance = await multiPoolLPToken.balanceOf(addr2.address)

      expect( fromUsdc(await usdc.balanceOf(addr2.address)) ).to.equal(0);
      expect( fromUsdc(await lptoken.balanceOf(multiPool.address)) ).to.be.approximately(4000, 10);
      expect( Math.round( addr2Balance.mul(100).div(addr1Balance).toNumber() / 100 ) ).to.equal( 3 );
      expect( fromUsdc(addr1Balance) ).to.be.approximately( 1000, 3 );
      expect( fromUsdc(addr2Balance) ).to.be.approximately( 3000, 7 );
      expect( await multiPoolLPToken.totalSupply() ).to.equal( addr1Balance.add(addr2Balance) );

    });


  })



  describe("Deposit into a MultiPool of Pool01, Pool02, Pool03", function () {


    it("Should deposit into the pools proportionally to the pool weights", async function () {
      const { multiPool, multiPoolLPToken, owner, usdc, pool1, pool2, pool3 } = await loadFixture(deployIndexV3Fixture);

      const lptoken01 = new Contract(pools.pool01.lptoken, abis["erc20"], ethers.provider)
      const lptoken02 = new Contract(pools.pool02.lptoken, abis["erc20"], ethers.provider)
      const lptoken03 = new Contract(pools.pool03.lptoken, abis["erc20"], ethers.provider)

      // add pools with 20% / 30% / 50% weights
      await multiPool.addPool("Pool01", pools.pool01.address, pools.pool01.lptoken, 20)
      await multiPool.addPool("Pool02", pools.pool02.address, pools.pool02.lptoken, 30)
      await multiPool.addPool("Pool03", pools.pool03.address, pools.pool03.lptoken, 50)

      // transfer usdcs to owner
      await transferFunds(1_000 * 10 ** 6, owner.address)

      const depositAmount = 1_000 * 10 ** 6
      await usdc.connect(owner).approve(multiPool.address, depositAmount)

      const bal01a = await pool1.totalValue()
      const bal02a = await pool2.totalValue()
      const bal03a = await pool3.totalValue()

      //FIXME empty the pools before depositing 
      //  deposit funds intp Pool01, Pool02, Pool03 according to the MultiPool weights
      await multiPool.deposit(depositAmount);

      const bal01b = await pool1.totalValue()
      const bal02b = await pool2.totalValue()
      const bal03b = await pool3.totalValue()

      expect( round( (bal01b - bal01a) / 10 ** 6) ).to.be.approximately( 200, 1)
      expect( round( (bal02b - bal02a) / 10 ** 6) ).to.be.approximately( 300, 1)
      expect( round( (bal03b - bal03a) / 10 ** 6) ).to.be.approximately( 500, 1)
 
      // verify that the user go the expected MultiPool LP tokens
      expect( fromUsdc(await multiPoolLPToken.balanceOf(owner.address)) ).to.be.approximately(1000, 2);

      // verify that the % of new LP tokens issued by Pool01, Pool02, Pool03  
      // matches the % of the new capital deposited into the pools
      expect( fromUsdc( await lptoken01.totalSupply() )  ).to.equal( 200 );
      expect( fromUsdc( await lptoken02.totalSupply() )  ).to.equal( 300 );
      expect( fromUsdc( await lptoken03.totalSupply() )  ).to.equal( 500 );

      // withdraw all 
      await multiPool.withdrawLP( await multiPoolLPToken.balanceOf(owner.address) );

      expect( fromUsdc( await pool1.totalValue() )  ).to.equal( 0 );
      expect( fromUsdc( await pool2.totalValue() )  ).to.equal( 0 );
      expect( fromUsdc( await pool3.totalValue() )  ).to.equal( 0 );
      
      expect( fromUsdc( await lptoken01.totalSupply() )  ).to.equal( 0 );
      expect( fromUsdc( await lptoken02.totalSupply() )  ).to.equal( 0 );
      expect( fromUsdc( await lptoken03.totalSupply() )  ).to.equal( 0 );

    }).timeout(60000);



    it("Should receive a share of LP tokens based on the value in the Index", async function () {

      const { multiPool, multiPoolLPToken, owner, addr1, addr2, usdc, pool1, pool2, pool3 } = await loadFixture(deployIndexV3Fixture);

      const lptoken01 = new Contract(pools.pool01.lptoken, abis["erc20"], ethers.provider)
      const lptoken02 = new Contract(pools.pool02.lptoken, abis["erc20"], ethers.provider)
      const lptoken03 = new Contract(pools.pool03.lptoken, abis["erc20"], ethers.provider)

      // add pools with 20% / 30% / 50% weights
      await multiPool.addPool("Pool01", pools.pool01.address, pools.pool01.lptoken, 20)
      await multiPool.addPool("Pool02", pools.pool02.address, pools.pool02.lptoken, 30)
      await multiPool.addPool("Pool03", pools.pool03.address, pools.pool03.lptoken, 50)

      // transfer usdc to addr1
      await transferFunds(9_000 * 10 ** 6, addr1.address)

      // addr1 depoists $1_000 directly into pool1, pool2, pool3
      const deposit1 = 1_000 * 10 ** 6
      await usdc.connect(addr1).approve(pool1.address, deposit1)
      await usdc.connect(addr1).approve(pool2.address, deposit1)
      await usdc.connect(addr1).approve(pool3.address, deposit1)

      await pool1.connect(addr1).deposit(deposit1)
      await pool2.connect(addr1).deposit(deposit1)
      await pool3.connect(addr1).deposit(deposit1)

      // ensure pool LPs are correctly issued
      const lp1a = fromUsdc( await lptoken01.totalSupply() )
      const lp2a = fromUsdc( await lptoken02.totalSupply() )
      const lp3a = fromUsdc( await lptoken03.totalSupply() )
      expect( lp1a  ).to.equal( 1_000 );
      expect( lp2a  ).to.equal( 1_000 );
      expect( lp3a  ).to.equal( 1_000 );
      expect( Math.round(fromUsdc(await multiPool.totalValue()))  ).to.equal( 0 );

      // addr1 deposit $6000 into the MultiPool
      const multipoolDeposit = 6_000 * 10 ** 6
      await usdc.connect(addr1).approve(multiPool.address, multipoolDeposit)
      await multiPool.connect(addr1).deposit(multipoolDeposit);

      // verify MultiPoolLP issued correspond to addr1 deposit
      expect( Math.round(fromUsdc(await multiPoolLPToken.totalSupply()))  ).to.be.approximately( 6000, 15 );
      expect( Math.round(fromUsdc(await multiPoolLPToken.balanceOf(addr1.address)))  ).to.be.approximately( 6000, 15 );

      // verify MultiPool value corresponds to addr1 deposit
      expect( Math.round(fromUsdc(await multiPool.totalValue())) ).to.be.approximately( 6000, 15 );

      /// addr2 deposits $1000 nto the MultiPool
      const multipoolDeposit2 = 1_000 * 10 ** 6
      await transferFunds(multipoolDeposit2, addr2.address)
      await usdc.connect(addr2).approve(multiPool.address, multipoolDeposit2)
      await multiPool.connect(addr2).deposit(multipoolDeposit2);

      // verify MultiPoolLP issued to addr2 for about 1/7 of supply
      expect( Math.round(fromUsdc(await multiPoolLPToken.balanceOf(addr2.address)))  ).to.be.approximately( 1000, 5 );
      expect( Math.round(fromUsdc(await multiPoolLPToken.totalSupply())) ).to.be.approximately( 7000, 20 );

      // verify MultiPool value increased by about $1000
      expect( Math.round(fromUsdc(await multiPool.totalValue()))  ).to.be.approximately( 7000, 20 );

    }).timeout(60000);

  })




  describe("Withdraw from Pool02", function () {


    it("Should burn the MultiPool LP tokens for the amount withdrawn", async function () {
      const { multiPool, multiPoolLPToken, owner, usdc } = await loadFixture(deployIndexV3Fixture);

      // add pool
      multiPool.addPool("Pool02", pools.pool02.address, pools.pool02.lptoken, 100)
      const pool = new Contract(pools.pool02.address, abis["poolV3"], ethers.provider)

      // transfer usdc to user
      await transferFunds(1_000 * 10 ** 6, owner.address)

      const depositAmount = 1_000 * 10 ** 6
      await usdc.connect(owner).approve(multiPool.address, depositAmount)

      // deposit funds
      await multiPool.deposit(depositAmount);

      // withdrawy 300 LP tokens
      await multiPool.withdrawLP(300 * 10 ** 6);

      expect( fromUsdc(await multiPoolLPToken.balanceOf(owner.address)) ).to.be.approximately( 700, 5);
      expect( fromUsdc(await multiPoolLPToken.totalSupply()) ).to.be.approximately( 700, 5 );

      // withdrawy the remaining LP tokens
      await multiPool.withdrawLP(0);
   
      // verify all LP have been withdrawn and burned and Index is not empty
      expect( fromUsdc(await multiPoolLPToken.balanceOf(owner.address)) ).to.equal(0);
      expect( fromUsdc(await multiPoolLPToken.totalSupply())  ).to.equal(0);
      expect( fromUsdc(await pool.totalValue()) ).to.equal(0);

    });
  });

});


async function emptyPool(poolAddr: string) {

    const pool = new Contract(poolAddr, abis["poolV3"], ethers.provider)
    const poolLPAddr = await pool.lpToken()
    const poolLP = new Contract(poolLPAddr, abis["erc20"], ethers.provider)
 
    // take liquidity from pool
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [poolOwner],
    });
    const signer = await ethers.getSigner(poolOwner);

    const balance = await poolLP.balanceOf(signer.address)
    if (balance > 0) {
      await pool.connect(signer).withdrawAll()
    }

    /// take fees from pool
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [pool.address],
    });

    const pooSigner = await ethers.getSigner(pool.address);
    await pool.connect(signer).collectFees(0)

}


async function transferFunds(amount: number, recipient: string) {

  // 48,354,222.149244   100.000000
  const [owner, addr1, addr2] = await ethers.getSigners();
  const usdc = new Contract(usdcAddress, abis["erc20"], ethers.provider)

  // impersonate 'account'
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [usdcSource],
  });
  const signer = await ethers.getSigner(usdcSource);
  await usdc.connect(signer).transfer(recipient, amount)
}




const pools = {
  pool01: {
    address: '0x8714336322c091924495B08938E368Ec0d19Cc94',
    lptoken: '0x49c3ad1bF4BeFb024607059cb851Eb793c224BaB',
  },
  pool02: {
    address: '0xD963e4C6BE2dA88a1679A40139C5b75961cc2619',
    lptoken: '0xC27E560E3D1546edeC5DD858D404EbaF2166A763',
  },
  pool03: {
    address: '0x63151e56140E09999983CcD8DD05927f9e8be81D',
    lptoken: '0xCdf8886cEea718ad37e02e9a421Eb674F20e5ba1',
  }
}
