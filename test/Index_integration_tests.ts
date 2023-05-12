import { expect } from "chai";
import { Contract } from "ethers"
import { ethers, network } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { fromUsdc } from "./helpers"

import poolV4_abi from '../scripts/abis/poolv4.json'
import indexV4_abi from '../scripts/abis/indexV4.json'
import erc20_abi from '../scripts/abis/erc20.json'

const poolOwner = '0xb888488a3796bdf8bbb3f6e8a0d4672bdedcbe72'
const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const usdcSource = '0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245' // rich account owing 48,354,222.149244  USDC


describe("Index contract", function () {

    async function getContracts() {
        const [owner, addr1, addr2] = await ethers.getSigners();

        const usdc = new Contract(usdcAddress, erc20_abi, ethers.provider)

        const pool1 = new Contract(pools.pool01.address, poolV4_abi, ethers.provider)
        const pool2 = new Contract(pools.pool02.address, poolV4_abi, ethers.provider)
        const pool3 = new Contract(pools.pool03.address, poolV4_abi, ethers.provider)
        const pool4 = new Contract(pools.pool04.address, poolV4_abi, ethers.provider)
        const pool5 = new Contract(pools.pool05.address, poolV4_abi, ethers.provider)
        const pool6 = new Contract(pools.pool06.address, poolV4_abi, ethers.provider)

        emptyPool(pool1.address)
        emptyPool(pool2.address)
        emptyPool(pool3.address)
        emptyPool(pool4.address)
        emptyPool(pool5.address)
        emptyPool(pool5.address)

        const pool1Lp = new Contract(pools.pool01.lptoken, erc20_abi, ethers.provider)
        const pool2Lp = new Contract(pools.pool02.lptoken, erc20_abi, ethers.provider)
        const pool3Lp = new Contract(pools.pool03.lptoken, erc20_abi, ethers.provider)
        const pool4Lp = new Contract(pools.pool04.lptoken, erc20_abi, ethers.provider)
        const pool5Lp = new Contract(pools.pool05.lptoken, erc20_abi, ethers.provider)
        const pool6Lp = new Contract(pools.pool06.lptoken, erc20_abi, ethers.provider)

        const index1 = new Contract(indexes.multiPool01.pool, indexV4_abi, ethers.provider)
        const index2 = new Contract(indexes.multiPool02.pool, indexV4_abi, ethers.provider)
        const index3 = new Contract(indexes.multiPool03.pool, indexV4_abi, ethers.provider)

        const multipoolLp1 = new Contract(indexes.multiPool01.pool_lp, erc20_abi, ethers.provider)
        const multipoolLp2 = new Contract(indexes.multiPool02.pool_lp, erc20_abi, ethers.provider)
        const multipoolLp3 = new Contract(indexes.multiPool03.pool_lp, erc20_abi, ethers.provider)

        // Fixtures can return anything you consider useful for your tests
        return {
            owner, addr1, addr2, usdc,
            index1, index2, index3,
            multipoolLp1, multipoolLp2, multipoolLp3,
            pool1, pool2, pool3, pool4, pool5, pool6,
            pool1Lp, pool2Lp, pool3Lp, pool4Lp, pool5Lp, pool6Lp
        };
    }


    // You can nest describe calls to create subsections.
    describe("IndexClient", function () {


        it.skip("Should have the right deposit token address", async function () {
            const { index1, index2, index3 } = await loadFixture(getContracts);

            expect(await index1.depositToken()).to.equal(usdcAddress);
            expect(await index2.depositToken()).to.equal(usdcAddress);
            expect(await index3.depositToken()).to.equal(usdcAddress);
        });


        it.skip("Should allow a user to deposit into the Index", async function () {
            const { index3, owner, usdc, pool1, pool2, pool3, pool4, pool5, pool6 } = await loadFixture(getContracts);

            // deposit funds
            const deposit = 20_000 * 10 ** 6
            await transferFunds(deposit, owner.address)
            await usdc.connect(owner).approve(index3.address, deposit)
            await index3.connect(owner).deposit(deposit);

            console.log("pool1: ", fromUsdc(await pool1.totalValue()))
            console.log("pool2: ", fromUsdc(await pool2.totalValue()))
            console.log("pool3: ", fromUsdc(await pool3.totalValue()))
            console.log("pool4: ", fromUsdc(await pool4.totalValue()))
            console.log("pool5: ", fromUsdc(await pool5.totalValue()))
            console.log("pool6: ", fromUsdc(await pool6.totalValue()))
            console.log("Total: ", fromUsdc(await index3.totalValue()))

        }).timeout(300000);


        it.skip("Should allow a user to deposit into the Index", async function () {
            const { index3, multipoolLp3, owner, usdc, pool1, pool2, pool3, pool4, pool5, pool6 } = await loadFixture(getContracts);

            await transferFunds(1_000 * 10 ** 6, owner.address)

            // deposit funds
            const deposit = 1_000 * 10 ** 6

            await usdc.connect(owner).approve(index3.address, deposit)
            await index3.connect(owner).deposit(deposit);

            expect(Math.round(fromUsdc(await multipoolLp3.balanceOf(owner.address)))).to.equal(999);

            expect(Math.floor(fromUsdc(await pool1.totalValue()))).to.equal(166);
            expect(Math.floor(fromUsdc(await pool2.totalValue()))).to.equal(166);
            expect(Math.floor(fromUsdc(await pool3.totalValue()))).to.equal(166);
            expect(Math.floor(fromUsdc(await pool4.totalValue()))).to.equal(166);
            expect(Math.floor(fromUsdc(await pool5.totalValue()))).to.equal(166);
            expect(Math.floor(fromUsdc(await pool6.totalValue()))).to.equal(166);

        }).timeout(300000);

        it.skip("Should allow a user to withdraw from the Index", async function () {
            const { index3, multipoolLp3, addr1, addr2, usdc } = await loadFixture(getContracts);

            await transferFunds(1_000 * 10 ** 6, addr1.address)
            await transferFunds(2_000 * 10 ** 6, addr2.address)

            // addr1 deposit funds
            const deposit = 1_000 * 10 ** 6
            await usdc.connect(addr1).approve(multipool3.address, deposit)
            await multipool3.connect(addr1).deposit(deposit);

            expect(fromUsdc(await usdc.balanceOf(addr1.address))).to.equal(0);
            expect(Math.round(fromUsdc(await multipoolLp3.balanceOf(addr1.address)))).to.equal(999);
            expect(Math.round(fromUsdc(await index3.totalPoolsValue()))).to.equal(999);

            // addr2 deposit funds
            const deposit2 = 2_000 * 10 ** 6
            await usdc.connect(addr2).approve(index3.address, deposit2)
            await index3.connect(addr2).deposit(deposit2);

            expect(Math.round(fromUsdc(await multipoolLp3.balanceOf(addr2.address)))).to.equal(2 * 999);

            // addr1 withdraws all LP
            await index3.connect(addr1).withdrawAll();

            expect(await multipoolLp3.balanceOf(addr1.address)).to.equal(0);
            expect(Math.round(fromUsdc(await index3.totalPoolsValue()))).to.equal(1998);
            expect(Math.round(fromUsdc(await index3.totalPoolsValue()))).to.equal(1998);
            expect(Math.round(fromUsdc(await usdc.balanceOf(addr1.address)))).to.equal(997);

        }).timeout(300000);


    });

});


async function transferFunds(amount: number, recipient: string) {

    // 48,354,222.149244   100.000000
    const [owner, addr1, addr2] = await ethers.getSigners();
    const usdc = new Contract(usdcAddress, erc20_abi, ethers.provider)

    // impersonate 'account'
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [usdcSource],
    });
    const signer = await ethers.getSigner(usdcSource);
    await usdc.connect(signer).transfer(recipient, amount)
}



const indexes = {
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
        address: '0xaba6D49a6ED92346398b981ffA48157A01c64be1',
        lptoken: '0x472eFE6340652E73fcE7f359e6e0D7697Dacb6b9',
    },
    pool02: {
        address: '0x80694be2C2765211F4D4107cfA71B5756d08D2a7',
        lptoken: '0xDBa7c5fA8BA565914495a56961F06f065d4c1871',
    },
    pool03: {
        address: '0x0322055E90EC6a0386AD475a70F29d4Bcfef2995',
        lptoken: '0xc590EdC5C160cf5d4863AdB277552497e818fE97',
    },
    pool04: {
        address: '0xe079B684859b1132c815600BA992E701eEa56737',
        lptoken: '0x42B0e4214332a40a8ea4a4a029212FC3CfdE1c11',
    },
    pool05: {
        address: '0x668B59ce0d1811593198dc33Aa3d25E36bDa4611',
        lptoken: '0x16dBE506728359Aa7bF632EC7DF50505456C9A54',
    },
    pool06: {
        address: '0x2dDc8cc4785bb1A0091c6835E347f6EC0219148c',
        lptoken: '0xa1A3f45613946D49777fB3924d6484D8763CFC45',
    }
}



async function emptyPool(poolAddr: string) {

    const pool = new Contract(poolAddr, poolV4_abi, ethers.provider)
    const poolLPAddr = await pool.lpToken()
    const poolLP = new Contract(poolLPAddr, erc20_abi, ethers.provider)
    const userArrds = await pool.getUsers()

    for (const user of userArrds) {
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [user],
        });
        const signer = await ethers.getSigner(user);
        await pool.connect(signer).withdrawAll()
    }

    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [poolOwner],
    });
    const signer = await ethers.getSigner(poolOwner);
    await pool.connect(signer).collectFees(0)

}
