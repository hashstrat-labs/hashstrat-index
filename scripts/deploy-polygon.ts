import { ethers } from "hardhat";


// USDC on Polygon
const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const lpDecimals = 6

async function main() {

	// depolyIndex("Rebal [BTC + ETH]", [
	// 	{ name: "pool01v3a", weight: 1 },
	// 	{ name: "pool02v3a", weight: 1 },
	// ])

	// depolyIndex("MeanRev [BTC + ETH]", [
	//   { name: "pool03v3a", weight: 1 },
	//   { name: "pool04v3a", weight: 1 },
	// ])

	depolyIndex( "TrendFollow [BTC + ETH]", [
	  { name: "pool05v3a", weight: 1 },
	  { name: "pool06v3a", weight: 1 },
	])
}


async function depolyIndex(name: string, pools: Array<Pool>) {

	console.log("Starting deployment of IndexV3: ", name, "on POLYGON")

	const IndexV3 = await ethers.getContractFactory("IndexV3");
	const IndexLPToken = await ethers.getContractFactory("IndexLPToken");

	const indexLPToken = await IndexLPToken.deploy("IndexLP Token", "IndexLP", lpDecimals)
	await indexLPToken.deployed()
	console.log("LPToken deployed at address:", indexLPToken.address);

	const index = await IndexV3.deploy(usdcAddress, indexLPToken.address);
	await index.deployed();
	console.log("IndexV3 deployed at address:", index.address);

	// add minter
	await indexLPToken.addMinter(index.address)
	console.log("added minter to IndexLP token");

	// add pools
	for (var pool of pools) {
		const info = polygonPools[pool.name]
		const name = pool.name.replace(/^./, pool.name[0].toUpperCase())
		console.log("adding pool ", name, info.pool, info.pool_lp, pool.weight)

		await index.addPool(name, info.pool, info.pool_lp, pool.weight)
	}

	console.log("Completed IndexV3 deployment")
}



// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});



type Pool = {
	name: keyof typeof polygonPools;
	weight: number;
};

const polygonPools = {
	"pool01v3a": {
		"pool": "0x8714336322c091924495B08938E368Ec0d19Cc94",
		"pool_lp": "0x49c3ad1bF4BeFb024607059cb851Eb793c224BaB",
		"strategy": "0xbfB7A8caF44fD28188673B09aa3B2b00eF301118",
		"price_feed": "0xc907E116054Ad103354f2D350FD2514433D57F6f"
	},
	"pool02v3a": {
		"pool": "0xD963e4C6BE2dA88a1679A40139C5b75961cc2619",
		"pool_lp": "0xC27E560E3D1546edeC5DD858D404EbaF2166A763",
		"strategy": "0xc78BD1257b7fE3Eeb33fC824313C71D145C9754b",
		"price_feed": "0xF9680D99D6C9589e2a93a78A04A279e509205945"
	},
	"pool03v3a": {
		"pool": "0x63151e56140E09999983CcD8DD05927f9e8be81D",
		"pool_lp": "0xCdf8886cEea718ad37e02e9a421Eb674F20e5ba1",
		"strategy": "0x4687faf8e60ca8e532af3173C0225379939261F7",
		"price_feed": "0xc907E116054Ad103354f2D350FD2514433D57F6f"
	},
	"pool04v3a": {
		"pool": "0xd229428346E5Ba2F08AbAf52fE1d2C941ecB36AD",
		"pool_lp": "0xe4FF896D756Bdd6aa1208CDf05844335aEA56297",
		"strategy": "0xB98203780925694BAeAFDC7CB7C6ECb1E6631D17",
		"price_feed": "0xF9680D99D6C9589e2a93a78A04A279e509205945"
	},
	"pool05v3a": {
		"pool": "0xCfcF4807d10C564204DD131527Ba8fEb08e2cc9e",
		"pool_lp": "0x80bc0b435b7e7F0Dc3E95C3dEA87c68D5Ade4378",
		"strategy": "0xBbe4786c0D1cEda012B8EC1ad12a2F7a1A5941f1",
		"price_feed": "0xc907E116054Ad103354f2D350FD2514433D57F6f"
	},
	"pool06v3a": {
		"pool": "0xa2f3c0FDC55814E70Fdac2296d96bB04840bE132",
		"pool_lp": "0x2523c4Ab54f5466A8b8eEBCc57D8edC0601faB54",
		"strategy": "0x62386A92078CC4fEF921F9bb1f515464e2f7918f",
		"price_feed": "0xF9680D99D6C9589e2a93a78A04A279e509205945"
	}
}
