import { expect } from "chai";
import { Contract } from "ethers"
import { ethers, network } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { fromUsdc, round, toWei } from "./helpers"

import poolV4_abi from '../scripts/abis/poolv4.json'
import erc20_abi from '../scripts/abis/erc20.json'


const poolOwner = '0xb888488a3796bdf8bbb3f6e8a0d4672bdedcbe72'
const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const usdcSource = '0xe7804c37c13166ff0b37f5ae0bb07a3aebb6e245' // rich account owing 48,354,222.149244  USDC


describe("Index contract", function () {

    // We define a fixture to reuse the same setup in every test. We use
    // loadFixture to run this setup once, snapshot that state, and reset Hardhat
    // Network to that snapshopt in every test.
    async function deployIndexV4() {

        // Deploy LP Token
        const IndexLPToken = await ethers.getContractFactory("IndexLPToken");
        const indexLPToken = await IndexLPToken.deploy("HashStrat LP", "HSLP", 6)
        await indexLPToken.deployed()

        // Deploy Index
        const IndexV4 = await ethers.getContractFactory("IndexV4");
        const indexV4 = await IndexV4.deploy(usdcAddress, indexLPToken.address);
        await indexV4.deployed();

        const [owner, addr1, addr2] = await ethers.getSigners();

        // indexLPToken: add Pool as minter
        await indexLPToken.addMinter(indexV4.address)

        const usdc = new Contract(usdcAddress, erc20_abi, ethers.provider)
        const pool1 = new Contract(pools.pool01v4.pool, poolV4_abi, ethers.provider)
        const pool3 = new Contract(pools.pool03v4.pool, poolV4_abi, ethers.provider)
        const pool5 = new Contract(pools.pool05v4.pool, poolV4_abi, ethers.provider)

        console.log("====  emptying pools ====")
        await emptyPools()

        // burn usd held by accounts
        await usdc.connect(addr1).transfer(usdc.address, await usdc.balanceOf(addr1.address))
        await usdc.connect(addr2).transfer(usdc.address, await usdc.balanceOf(addr2.address))
        await usdc.connect(owner).transfer(usdc.address, await usdc.balanceOf(owner.address))

        // Fixtures can return anything you consider useful for your tests
        return { indexV4, indexLPToken, owner, addr1, addr2, usdc, pool1, pool3, pool5 };

    }


    // You can nest describe calls to create subsections.
    describe("Deployment", function () {
        it("Set the right deposit token address", async function () {
            const { indexV4 } = await loadFixture(deployIndexV4);

            expect(await indexV4.depositToken()).to.equal(usdcAddress);
        });

    });


    describe("Deposit into an Index with a Pool02", function () {

      it("Should allocate LP tokens to the user and the Index", async function () {

        const { indexV4, indexLPToken, addr1, addr2, owner, usdc } = await loadFixture(deployIndexV4);

        const poolLPToken = new Contract(pools.pool01v4.pool_lp, erc20_abi, ethers.provider)
        await indexV4.addPool("Pool01", pools.pool01v4.pool, pools.pool01v4.pool_lp, 1)
        
        // addr2 deposits in the pool
        const pool = new Contract(pools.index03v3b.pool, poolV4_abi, ethers.provider)
        const poolDeposit = 10_000 * 10 ** 6
        await transferFunds(poolDeposit, addr2.address)
        await usdc.connect(addr2).approve(pools.index03v3b.pool, poolDeposit)
        await pool.connect(addr2).deposit(poolDeposit);

        // addr1 deposit in the index
        const depositAmount = 1_000 * 10 ** 6
        await transferFunds(depositAmount, addr1.address)
        await usdc.connect(addr1).approve(indexV4.address, depositAmount)
        await indexV4.connect(addr1).deposit(depositAmount);

        const totalValue = await indexV4.totalValue();
        const totalPoolsValue = await indexV4.totalPoolsValue();

        expect( fromUsdc(totalValue) ).to.be.approximately(1000, 3);
        expect( fromUsdc(await poolLPToken.balanceOf(indexV4.address)) ).to.be.approximately(1000, 3);
        expect( fromUsdc(await indexLPToken.balanceOf(addr1.address)) ).to.be.approximately(1000, 3);
        expect( fromUsdc(await indexLPToken.totalSupply()) ).to.be.approximately(1000, 3);

      });

    })


    describe("Deposit into a non empty Pool", function () {

        it("Should allocate the expected LP tokens when an account deposits an amount that is 'less than' the value in the pool", async function () {
            const { indexV4, indexLPToken, addr1, addr2, usdc } = await loadFixture(deployIndexV4);

            const lptoken = new Contract(pools.pool01v4.pool_lp, erc20_abi, ethers.provider)
            await indexV4.addPool("Pool01", pools.pool01v4.pool, pools.pool01v4.pool_lp, 1)

            // transfer usdc to owner
            await transferFunds(3_000 * 10 ** 6, addr1.address)
            await transferFunds(1_000 * 10 ** 6, addr2.address)

            // addr1 deposit funds
            const depositAmount1 = 3_000 * 10 ** 6
            await usdc.connect(addr1).approve(indexV4.address, depositAmount1)
            await indexV4.connect(addr1).deposit(depositAmount1);

            // addr2 deposit funds
            const depositAmount2 = 1_000 * 10 ** 6
            await usdc.connect(addr2).approve(indexV4.address, depositAmount2)
            await indexV4.connect(addr2).deposit(depositAmount2);

            const addr1Balance = await indexLPToken.balanceOf(addr1.address)
            const addr2Balance = await indexLPToken.balanceOf(addr2.address)

            expect(fromUsdc(await usdc.balanceOf(addr2.address))).to.equal(0);
            expect(fromUsdc(await lptoken.balanceOf(indexV4.address))).to.be.approximately(4_000, 10);
            expect(addr1Balance.div(addr2Balance)).to.equal(3);
            expect(fromUsdc(addr1Balance)).to.be.approximately(3000, 5);
            expect(fromUsdc(addr2Balance)).to.be.approximately(1000, 2);

            expect(await indexLPToken.totalSupply()).to.equal(addr1Balance.add(addr2Balance));
        });


        it("Should allocate the expected LP tokens when an account deposits an amount is 'greater than' the value in the pool", async function () {
            const { indexV4, indexLPToken, addr1, addr2, usdc } = await loadFixture(deployIndexV4);

            const lptoken = new Contract(pools.pool01v4.pool_lp, erc20_abi, ethers.provider)
            await indexV4.addPool("Pool01", pools.pool01v4.pool, pools.pool01v4.pool_lp, 1)

            // transfer usdc to addr1, addr2
            await transferFunds(1_000 * 10 ** 6, addr1.address)
            await transferFunds(3_000 * 10 ** 6, addr2.address)

            // addr1 deposit funds
            const depositAmount1 = 1_000 * 10 ** 6
            await usdc.connect(addr1).approve(indexV4.address, depositAmount1)
            await indexV4.connect(addr1).deposit(depositAmount1);

            // addr2 deposit funds
            const depositAmount2 = 3_000 * 10 ** 6
            await usdc.connect(addr2).approve(indexV4.address, depositAmount2)
            await indexV4.connect(addr2).deposit(depositAmount2);

            const addr1Balance = await indexLPToken.balanceOf(addr1.address)
            const addr2Balance = await indexLPToken.balanceOf(addr2.address)

            expect(fromUsdc(await usdc.balanceOf(addr2.address))).to.equal(0);
            expect(fromUsdc(await lptoken.balanceOf(indexV4.address))).to.be.approximately(4000, 10);
            expect(Math.round(addr2Balance.mul(100).div(addr1Balance).toNumber() / 100)).to.equal(3);
            expect(fromUsdc(addr1Balance)).to.be.approximately(1000, 3);
            expect(fromUsdc(addr2Balance)).to.be.approximately(3000, 7);
            expect(await indexLPToken.totalSupply()).to.equal(addr1Balance.add(addr2Balance));
        });


        it("Should allocate no more LP tokens that were allocated for a prior deposit of same deposit amount", async function () {
            const { indexV4, indexLPToken, addr1, addr2, usdc } = await loadFixture(deployIndexV4);

            await indexV4.addPool("Pool01", pools.pool01v4.pool, pools.pool01v4.pool_lp, 1)

            expect(fromUsdc(await usdc.balanceOf(addr1.address)) ).to.be.equal(0);
            expect(fromUsdc(await usdc.balanceOf(addr2.address)) ).to.be.equal(0);
            expect(fromUsdc(await indexV4.totalValue()) ).to.be.equal(0);
            
            // transfer usdc to addr1, addr2
            await transferFunds(1_000 * 10 ** 6, addr1.address)
            await transferFunds(1_000 * 10 ** 6, addr2.address)

            // addr1 deposit funds
            const depositAmount1 = 1_000 * 10 ** 6
            await usdc.connect(addr1).approve(indexV4.address, depositAmount1)
            await indexV4.connect(addr1).deposit(depositAmount1);

            // addr2 deposit funds
            const depositAmount2 = 1_000 * 10 ** 6
            await usdc.connect(addr2).approve(indexV4.address, depositAmount2)
            await indexV4.connect(addr2).deposit(depositAmount2);

            expect(fromUsdc(await usdc.balanceOf(addr1.address)) ).to.be.equal(0);
            expect(fromUsdc(await usdc.balanceOf(addr2.address)) ).to.be.equal(0);
            expect( await indexLPToken.balanceOf(addr2.address) ).to.be.lessThan( await indexLPToken.balanceOf(addr1.address) );

            // withdraw all 
            await indexV4.connect(addr2).withdrawAll();
            await indexV4.connect(addr1).withdrawAll();

            expect(fromUsdc(await usdc.balanceOf(addr1.address)) ).to.be.lessThan(1000);
            expect(fromUsdc(await usdc.balanceOf(addr2.address)) ).to.be.lessThan(1000);
            expect( await usdc.balanceOf(addr2.address) ).to.be.lessThanOrEqual( await usdc.balanceOf(addr1.address) );
            expect(await indexV4.totalValue()).to.be.equal( 0 )
        });
    })



    describe("Deposit into an Index of Pool01, Pool02, Pool03", function () {

        it("Should deposit into the pools proportionally to the pool weights", async function () {
            const { indexV4, indexLPToken, owner, usdc, pool1, pool3, pool5 } = await loadFixture(deployIndexV4);

            const lptoken01 = new Contract(pools.pool01v4.pool_lp, erc20_abi, ethers.provider)
            const lptoken02 = new Contract(pools.pool03v4.pool_lp, erc20_abi, ethers.provider)
            const lptoken03 = new Contract(pools.pool05v4.pool_lp, erc20_abi, ethers.provider)

            // add pools with 20% / 30% / 50% weights
            await indexV4.addPool("Pool01", pools.pool01v4.pool, pools.pool01v4.pool_lp, 20)
            await indexV4.addPool("Pool03", pools.pool03v4.pool, pools.pool03v4.pool_lp, 30)
            await indexV4.addPool("Pool05", pools.pool05v4.pool, pools.pool05v4.pool_lp, 50)

            // transfer usdcs to owner
            await transferFunds(1_000 * 10 ** 6, owner.address)

            const depositAmount = 1_000 * 10 ** 6
            await usdc.connect(owner).approve(indexV4.address, depositAmount)

            const bal01a = await pool1.totalValue()
            const bal02a = await pool3.totalValue()
            const bal03a = await pool5.totalValue()

            //FIXME empty the pools before depositing 
            //  deposit funds intp Pool01, Pool02, Pool03 according to the Index weights
            await indexV4.deposit(depositAmount);

            const bal01b = await pool1.totalValue()
            const bal02b = await pool3.totalValue()
            const bal03b = await pool5.totalValue()

            expect(round((bal01b - bal01a) / 10 ** 6)).to.be.approximately(200, 1)
            expect(round((bal02b - bal02a) / 10 ** 6)).to.be.approximately(300, 1)
            expect(round((bal03b - bal03a) / 10 ** 6)).to.be.approximately(500, 1)

            // verify that the user go the expected Index LP tokens
            expect(fromUsdc(await indexLPToken.balanceOf(owner.address))).to.be.approximately(1000, 2);

            // verify that the % of new LP tokens issued by Pool01, Pool02, Pool03  
            // matches the % of the new capital deposited into the pools
            expect(fromUsdc(await lptoken01.totalSupply())).to.be.approximately(200, 1);
            expect(fromUsdc(await lptoken02.totalSupply())).to.be.approximately(300, 1);
            expect(fromUsdc(await lptoken03.totalSupply())).to.be.approximately(500, 1);

            // withdraw all 
            await indexV4.withdrawLP(await indexLPToken.balanceOf(owner.address));

            expect(fromUsdc(await pool1.totalValue())).to.equal(0);
            expect(fromUsdc(await pool3.totalValue())).to.equal(0);
            expect(fromUsdc(await pool5.totalValue())).to.be.approximately(0, 0.01);

            expect(fromUsdc(await lptoken01.totalSupply())).to.equal(0);
            expect(fromUsdc(await lptoken02.totalSupply())).to.equal(0);
            expect(fromUsdc(await lptoken03.totalSupply())).to.be.approximately(0, 0.01);

        }).timeout(60000);


        it("Should receive a share of LP tokens based on the value in the Index", async function () {

            const { indexV4, indexLPToken, owner, addr1, addr2, usdc, pool1, pool3, pool5 } = await loadFixture(deployIndexV4);

            const lptoken01 = new Contract(pools.pool01v4.pool_lp, erc20_abi, ethers.provider)
            const lptoken02 = new Contract(pools.pool03v4.pool_lp, erc20_abi, ethers.provider)
            const lptoken03 = new Contract(pools.pool05v4.pool_lp, erc20_abi, ethers.provider)

            // add pools with 20% / 30% / 50% weights
            await indexV4.addPool("Pool01", pools.pool01v4.pool, pools.pool01v4.pool_lp, 20)
            await indexV4.addPool("Pool03", pools.pool03v4.pool, pools.pool03v4.pool_lp, 30)
            await indexV4.addPool("Pool05", pools.pool05v4.pool, pools.pool05v4.pool_lp, 50)

            // transfer usdc to addr1
            await transferFunds(9_000 * 10 ** 6, addr1.address)

            // addr1 depoists $1_000 directly into pool1, pool2, pool3
            const deposit = 1_000 * 10 ** 6
            await usdc.connect(addr1).approve(pool1.address, deposit)
            await usdc.connect(addr1).approve(pool3.address, deposit)
            await usdc.connect(addr1).approve(pool5.address, deposit)

            await pool1.connect(addr1).deposit(deposit)
            await pool3.connect(addr1).deposit(deposit)
            await pool5.connect(addr1).deposit(deposit)

            // ensure pool LPs are correctly issued
            const lp1a = fromUsdc(await lptoken01.totalSupply())
            const lp2a = fromUsdc(await lptoken02.totalSupply())
            const lp3a = fromUsdc(await lptoken03.totalSupply())
            expect(lp1a).to.be.approximately(1_000, 3);
            expect(lp2a).to.be.approximately(1_000, 3);
            expect(lp3a).to.be.approximately(1_000, 3);

            expect(fromUsdc(await indexV4.totalValue())).to.equal(0);

            // addr1 deposit $6000 into the Index
            const deposit1 = 6_000 * 10 ** 6
            await usdc.connect(addr1).approve(indexV4.address, deposit1)
            await indexV4.connect(addr1).deposit(deposit1);

            // verify IndexLP issued correspond to addr1 deposit
            expect(fromUsdc(await indexLPToken.totalSupply())).to.be.approximately(6000, 15);
            expect(fromUsdc(await indexLPToken.balanceOf(addr1.address))).to.be.approximately(6000, 15);

            // verify Index value corresponds to addr1 deposit
            expect(fromUsdc(await indexV4.totalValue())).to.be.approximately(6000, 15);

            /// addr2 deposits $1000 nto the Index
            const deposit2 = 1_000 * 10 ** 6
            await transferFunds(deposit2, addr2.address)
            await usdc.connect(addr2).approve(indexV4.address, deposit2)
            await indexV4.connect(addr2).deposit(deposit2);

            // verify IndexLP issued to addr2 for about 1/7 of supply
            expect(fromUsdc(await indexLPToken.balanceOf(addr2.address))).to.be.approximately(1000, 5);
            expect(fromUsdc(await indexLPToken.totalSupply())).to.be.approximately(7000, 20);

            // verify Index value increased by about $1000
            expect(fromUsdc(await indexV4.totalValue())).to.be.approximately(7000, 20);

        }).timeout(60000);

    })




    describe("Withdraw from an Index of 1 pool", function () {

        it("Should reduce value withdrawn in a sequence of deposits/withdrawals", async function () {
            const { indexV4, indexLPToken, addr1, addr2, usdc } = await loadFixture(deployIndexV4);

            // add pool2 (no deposits)
            await indexV4.addPool("Pool01", pools.pool01v4.pool, pools.pool01v4.pool_lp, 20)

            expect(fromUsdc(await usdc.balanceOf(addr1.address)) ).to.be.equal(0);
            expect(fromUsdc(await usdc.balanceOf(addr2.address)) ).to.be.equal(0);
            expect(fromUsdc(await indexV4.totalValue()) ).to.be.equal(0);
            
            // transfer usdc to addr1, addr2
            await transferFunds(10_000 * 10 ** 6, addr1.address)
            await transferFunds(1_000 * 10 ** 6, addr2.address)

            // first deposit
            const depositAmount1 = 10_000 * 10 ** 6
            await usdc.connect(addr1).approve(indexV4.address, depositAmount1)
            await indexV4.connect(addr1).deposit(depositAmount1);

            const valueBefore = await indexV4.totalValue()
            
            // sequence of deposits/withdrawals 
            for (const i of [...Array(10).keys()] ) {
                const depositAmount = await usdc.balanceOf(addr2.address)
                await usdc.connect(addr2).approve(indexV4.address, depositAmount)
                await indexV4.connect(addr2).deposit(depositAmount);

                await indexV4.connect(addr2).withdrawAll();
                const withdrawnAmount = await usdc.balanceOf(addr2.address)

                expect( await indexLPToken.balanceOf(addr2.address) ).to.be.equal( 0 );
                expect( depositAmount ).to.be.greaterThanOrEqual( withdrawnAmount )
            }

            expect(await indexV4.totalValue()).to.be.greaterThanOrEqual( valueBefore )
        });


        it("Should burn the Index LP tokens for the amount withdrawn", async function () {
            const { indexV4, indexLPToken, owner, usdc } = await loadFixture(deployIndexV4);

            // add pool
            indexV4.addPool("Pool02", pools.pool02v4.pool, pools.pool02v4.pool_lp, 100)
            const pool = new Contract(pools.pool02v4.pool, poolV4_abi, ethers.provider)

            // transfer usdc to user
            await transferFunds(1_000 * 10 ** 6, owner.address)

            const depositAmount = 1_000 * 10 ** 6
            await usdc.connect(owner).approve(indexV4.address, depositAmount)

            // deposit funds
            await indexV4.deposit(depositAmount);

            // withdrawy 300 LP tokens
            await indexV4.withdrawLP(300 * 10 ** 6);

            expect(fromUsdc(await indexLPToken.balanceOf(owner.address))).to.be.approximately(700, 5);
            expect(fromUsdc(await indexLPToken.totalSupply())).to.be.approximately(700, 5);

            // withdrawy the remaining LP tokens
            await indexV4.withdrawAll();

            // verify all LP have been withdrawn and burned and Index is not empty
            expect(fromUsdc(await indexLPToken.balanceOf(owner.address))).to.equal(0);
            expect(fromUsdc(await indexLPToken.totalSupply())).to.equal(0);
            expect(fromUsdc(await pool.totalValue())).to.equal(0);

        });
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




async function emptyPools() {
	for (const poolId of Object.keys(pools).filter(k => k.startsWith('index')))  {
		const poolInfo = pools[poolId as keyof typeof pools]
		await emptyIndex(poolId, poolInfo.pool)
	}

	for (const poolId of Object.keys(pools).filter(k => k.startsWith('pool')))  {
		const poolInfo = pools[poolId as keyof typeof pools]
		await emptyPool(poolId, poolInfo.pool)
	}
}



async function emptyPool(poolId: string, poolAddr: string) {

	console.log("emptyPool:", poolId);

    const pool = new Contract(poolAddr, poolV4_abi, ethers.provider)
    const poolLPAddr = await pool.lpToken()
    const poolLP = new Contract(poolLPAddr, erc20_abi, ethers.provider)
    const userArrds = await pool.getUsers()

	const poolAddresses = Object.keys(pools).map( k => pools[k as keyof typeof pools].pool )

    for (const user of userArrds) {
		if (poolAddresses.includes(user) ) {
			continue
		}

		/// external accounts withdrawa all funds
		const [ deployer ] = await ethers.getSigners();
		await deployer.sendTransaction({ to: user, value: toWei('1') });

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

    console.log("pool:",  poolId, "value: ", fromUsdc(await pool.totalValue()))
}




async function emptyIndex(indexId: string, poolAddr: string) {

	console.log("emptyIndex:", indexId);
    const pool = new Contract(poolAddr, poolV4_abi, ethers.provider)
    const poolLPToken = new Contract(await pool.lpToken(), erc20_abi, ethers.provider)

    const userArrds = await pool.getUsers()

    for (const user of userArrds) {
		/// external accounts withdrawa all funds
		const [ deployer ] = await ethers.getSigners();
		await deployer.sendTransaction({ to: user, value: toWei('1') });

		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [user],
		});
		const signer = await ethers.getSigner(user);
		await pool.connect(signer).withdrawLP( await poolLPToken.balanceOf(user) )
    }

    console.log("index:",  indexId, "value: ", fromUsdc(await pool.totalValue()))
}









        
const pools = {

	"pool01v4": {
		"pool": "0xaba6D49a6ED92346398b981ffA48157A01c64be1",
		"pool_lp": "0x472eFE6340652E73fcE7f359e6e0D7697Dacb6b9",
		"strategy": "0xbbd9c07a5AEfd98A3Ca8b19b1c6936f46e172fe8",
		"price_feed": "0xc907E116054Ad103354f2D350FD2514433D57F6f"
	},
	"pool02v4": {
		"pool": "0x80694be2C2765211F4D4107cfA71B5756d08D2a7",
		"pool_lp": "0xDBa7c5fA8BA565914495a56961F06f065d4c1871",
		"strategy": "0xC2150E00506933809bc4f665523f7e1c10c6b741",
		"price_feed": "0xF9680D99D6C9589e2a93a78A04A279e509205945"
	},
	"pool03v4": {
		"pool": "0x0322055E90EC6a0386AD475a70F29d4Bcfef2995",
		"pool_lp": "0xc590EdC5C160cf5d4863AdB277552497e818fE97",
		"strategy": "0x9445E3e218E2DFC0FE0796DEedc57694712a2453",
		"price_feed": "0xc907E116054Ad103354f2D350FD2514433D57F6f"
	},
	"pool04v4": {
		"pool": "0xe079B684859b1132c815600BA992E701eEa56737",
		"pool_lp": "0x42B0e4214332a40a8ea4a4a029212FC3CfdE1c11",
		"strategy": "0x671e8c79CB4cc708488e381849B26e49511588C1",
		"price_feed": "0xF9680D99D6C9589e2a93a78A04A279e509205945"
	},
	"pool05v4": {
		"pool": "0x668B59ce0d1811593198dc33Aa3d25E36bDa4611",
		"pool_lp": "0x16dBE506728359Aa7bF632EC7DF50505456C9A54",
		"strategy": "0x2E0FA38FAB4f2a02637B3dB2D40292c0635a3C2A",
		"price_feed": "0xc907E116054Ad103354f2D350FD2514433D57F6f"
	},
	"pool06v4": {
		"pool": "0x2dDc8cc4785bb1A0091c6835E347f6EC0219148c",
		"pool_lp": "0xa1A3f45613946D49777fB3924d6484D8763CFC45",
		"strategy": "0x6EF25E06b28660E7eDFC03333A0E50F887E8F7B3",
		"price_feed": "0xF9680D99D6C9589e2a93a78A04A279e509205945"
	},

	"index01v3b": {
		"pool": "0x3707d801bf06E0Ba2874b0C0CF27f8953e90De53",
		"pool_lp": "0x4EA664460531fA1Fbc7d95237B1B2C929754F19B"
	},
	"index02v3b": {
		"pool": "0x244e36cE30d3818FC5f3FaEc6CF796D949c0815A",
		"pool_lp": "0x928a739c679f4C2B323F6c9764cC7AeBA6c21e75"
	},
	"index03v3b": {
		"pool": "0x47b50e9c779721603D35A9eD463Fcc9B98D5c310",
		"pool_lp": "0xa427Aca157CEf004eFDa27aA5190da3152c7a26C"
	},

	"index04v3b": {
		"pool": "0x2099ac4a985d145C8E591b9Cb82848b8C179242a",
		"pool_lp": "0xa4A05C95a6cbBC01544b12Ee0dBdA490ae5551c4"
	},
	"index05v3b": {
		"pool": "0x0fB4dC1F74D92E335a45DD1b12c1f8F9d6C8F60e",
		"pool_lp": "0x0A38B7b2DA5aFA7371bECeE1b928e49f96aA5dB3"
	},
	"index06v3b": {
		"pool": "0xc91d0419539686aA065291aeEeE9d30646896188",
		"pool_lp": "0x0CFC8Fedd3eEa542c8da35Bc9848fa5c437D2c39"
	},
}