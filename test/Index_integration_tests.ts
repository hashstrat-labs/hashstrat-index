import { expect } from "chai";
import { Contract  } from "ethers"
import { ethers, network } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { fromUsdc } from "./helpers"

import abis from "./abis/abis.json";

const poolOwner = '0x4F888d90c31c97efA63f0Db088578BB6F9D1970C'
const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const usdcSource = '0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245' // rich account owing 48,354,222.149244  USDC


describe("Index contract", function () {

  async function getContracts() {
    const [owner, addr1, addr2] = await ethers.getSigners();

    const usdc = new Contract(usdcAddress, abis["erc20"], ethers.provider)

    const pool1 = new Contract(pools.pool01.address, abis["poolV3"], ethers.provider)
    const pool2 = new Contract(pools.pool02.address, abis["poolV3"], ethers.provider)
    const pool3 = new Contract(pools.pool03.address, abis["poolV3"], ethers.provider)
    const pool4 = new Contract(pools.pool04.address, abis["poolV3"], ethers.provider)
    const pool5 = new Contract(pools.pool05.address, abis["poolV3"], ethers.provider)
    const pool6 = new Contract(pools.pool06.address, abis["poolV3"], ethers.provider)

    emptyPool(pool1.address)
    emptyPool(pool2.address)
    emptyPool(pool3.address)
    emptyPool(pool4.address)
    emptyPool(pool5.address)
    emptyPool(pool5.address)

    const pool1Lp = new Contract(pools.pool01.lptoken, abis["erc20"], ethers.provider)
    const pool2Lp = new Contract(pools.pool02.lptoken, abis["erc20"], ethers.provider)
    const pool3Lp = new Contract(pools.pool03.lptoken, abis["erc20"], ethers.provider)
    const pool4Lp = new Contract(pools.pool04.lptoken, abis["erc20"], ethers.provider)
    const pool5Lp = new Contract(pools.pool05.lptoken, abis["erc20"], ethers.provider)
    const pool6Lp = new Contract(pools.pool06.lptoken, abis["erc20"], ethers.provider)

    const multipool1 = new Contract(multipools.multiPool01.pool, abis["indexV3"], ethers.provider)
    const multipool2 = new Contract(multipools.multiPool02.pool, abis["indexV3"], ethers.provider)
    const multipool3 = new Contract(multipools.multiPool03.pool, abis["indexV3"], ethers.provider)

    const multipoolLp1 = new Contract(multipools.multiPool01.pool_lp, abis["erc20"], ethers.provider)
    const multipoolLp2 = new Contract(multipools.multiPool02.pool_lp, abis["erc20"], ethers.provider)
    const multipoolLp3 = new Contract(multipools.multiPool03.pool_lp, abis["erc20"], ethers.provider)

    // Fixtures can return anything you consider useful for your tests
    return { owner, addr1, addr2, usdc, 
        multipool1, multipool2, multipool3, 
        multipoolLp1, multipoolLp2, multipoolLp3, 
        pool1, pool2, pool3, pool4, pool5, pool6,
        pool1Lp, pool2Lp, pool3Lp, pool4Lp, pool5Lp, pool6Lp
      };
  }


  // You can nest describe calls to create subsections.
  describe("IndexClient", function () {

    it("Should have fees to collect", async function () {

      const { pool1, pool2, pool3, pool4, pool5, pool6,
              pool1Lp, pool2Lp, pool3Lp, pool4Lp, pool5Lp, pool6Lp  } = await loadFixture(getContracts);
      
      const balance1 = await  pool1Lp.balanceOf(pool1.address)
      const balance2 = await  pool2Lp.balanceOf(pool2.address)
      const balance3 = await  pool3Lp.balanceOf(pool3.address)
      const balance4 = await  pool4Lp.balanceOf(pool4.address)
      const balance5 = await  pool5Lp.balanceOf(pool5.address)
      const balance6 = await  pool6Lp.balanceOf(pool6.address)

      const total = balance1.add(balance2).add(balance3).add(balance4).add(balance5).add(balance6)

      console.log("total: ", total.toString(), ">>> ", fromUsdc(total.toString()))
    });

    
    it("Should have the right deposit token address", async function () {
      const { multipool1, multipool2, multipool3 } = await loadFixture(getContracts);

      expect(await multipool1.depositToken()).to.equal(usdcAddress);
      expect(await multipool2.depositToken()).to.equal(usdcAddress);
      expect(await multipool3.depositToken()).to.equal(usdcAddress);
    });


    it("Should allow a user to deposit into the Index", async function () {
      const { multipool3, owner, usdc, pool1, pool2, pool3, pool4, pool5, pool6 } = await loadFixture(getContracts);

      // deposit funds
      const deposit = 20_000 * 10 ** 6
      await transferFunds(deposit, owner.address)
      await usdc.connect(owner).approve(multipool3.address, deposit)
      await multipool3.connect(owner).deposit(deposit);

      console.log("pool1: ", fromUsdc(await pool1.totalPortfolioValue())  )
      console.log("pool2: ", fromUsdc(await pool2.totalPortfolioValue())  )
      console.log("pool3: ", fromUsdc(await pool3.totalPortfolioValue())  )
      console.log("pool4: ", fromUsdc(await pool4.totalPortfolioValue())  )
      console.log("pool5: ", fromUsdc(await pool5.totalPortfolioValue())  )
      console.log("pool6: ", fromUsdc(await pool6.totalPortfolioValue())  )
      console.log("Total: ", fromUsdc( await multipool3.totalPoolsValue()) )

    }).timeout(300000);


    it("Should allow a user to deposit into the Index", async function () {
      const { multipool3, multipoolLp3, owner, usdc, pool1, pool2, pool3, pool4, pool5, pool6 } = await loadFixture(getContracts);

      await transferFunds(1_000 * 10 ** 6, owner.address)
      
      // deposit funds
      const deposit = 1_000 * 10 ** 6

      await usdc.connect(owner).approve(multipool3.address, deposit)
      await multipool3.connect(owner).deposit(deposit);

      expect( Math.round(fromUsdc(await multipoolLp3.balanceOf(owner.address))) ).to.equal(999);

      expect( Math.floor( fromUsdc(await pool1.totalPortfolioValue())) ).to.equal(166);
      expect( Math.floor( fromUsdc(await pool2.totalPortfolioValue())) ).to.equal(166);
      expect( Math.floor( fromUsdc(await pool3.totalPortfolioValue())) ).to.equal(166);
      expect( Math.floor( fromUsdc(await pool4.totalPortfolioValue())) ).to.equal(166);
      expect( Math.floor( fromUsdc(await pool5.totalPortfolioValue())) ).to.equal(166);
      expect( Math.floor( fromUsdc(await pool6.totalPortfolioValue())) ).to.equal(166);

    }).timeout(300000);

    it("Should allow a user to withdraw from the Index", async function () {
      const { multipool3, multipoolLp3, addr1, addr2, usdc } = await loadFixture(getContracts);
   
      await transferFunds(1_000 * 10 ** 6, addr1.address)
      await transferFunds(2_000 * 10 ** 6, addr2.address)

      // addr1 deposit funds
      const deposit = 1_000 * 10 ** 6
      await usdc.connect(addr1).approve(multipool3.address, deposit)
      await multipool3.connect(addr1).deposit(deposit);

      expect( fromUsdc(await usdc.balanceOf(addr1.address)) ).to.equal( 0 );
      expect( Math.round(fromUsdc( await multipoolLp3.balanceOf(addr1.address))) ).to.equal( 999 );
      expect( Math.round(fromUsdc( await multipool3.totalPoolsValue())) ).to.equal( 999 );

      // addr2 deposit funds
      const deposit2 = 2_000 * 10 ** 6
      await usdc.connect(addr2).approve(multipool3.address, deposit2)
      await multipool3.connect(addr2).deposit(deposit2);

      expect( Math.round(fromUsdc(await multipoolLp3.balanceOf(addr2.address))) ).to.equal( 2 * 999 );

      // addr1 withdraws all LP
      await multipool3.connect(addr1).withdrawLP(0);

      expect( await multipoolLp3.balanceOf(addr1.address) ).to.equal( 0 );
      expect( Math.round(fromUsdc( await multipool3.totalPoolsValue())) ).to.equal( 1998 );
      expect( Math.round(fromUsdc( await multipool3.totalPoolsValue())) ).to.equal( 1998 );
      expect( Math.round(fromUsdc(await usdc.balanceOf(addr1.address))) ).to.equal( 997 );

    }).timeout(300000);


  });

});


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




const multipools = {
    multiPool01: {
      pool: "0x9Abb51AC3A84787A2Fe2a829B890cb00ea8bCdfb",
      pool_lp: "0x99644c65345AB9C8CA198593F27BB83053774D1e"
    },
    multiPool02: {
        pool: "0x36de93a7d635F957A5E8533058786e3c96B3C9e1",
        pool_lp: "0x46c1DaE18e8DF4758eB535a8Be97Ca7a94563D39"
    },
    multiPool03: {
        pool: "0xd7689E9f3F38673cF56fa5C60b3764b69cfd20Bc",
        pool_lp: "0x7046310BaB92d4547f9fb23700346aa1dC1d679E"
    }
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
  },
  pool04: {
    address: '0xd229428346E5Ba2F08AbAf52fE1d2C941ecB36AD',
    lptoken: '0xe4FF896D756Bdd6aa1208CDf05844335aEA56297',
  },
  pool05: {
    address: '0xCfcF4807d10C564204DD131527Ba8fEb08e2cc9e',
    lptoken: '0x80bc0b435b7e7F0Dc3E95C3dEA87c68D5Ade4378',
  },
  pool06: {
    address: '0xa2f3c0FDC55814E70Fdac2296d96bB04840bE132',
    lptoken: '0x74243293f6642294d3cc94a9C633Ae943d557Cd3',
  }
}



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