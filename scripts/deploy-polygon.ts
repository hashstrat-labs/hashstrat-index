import { ethers } from "hardhat";


// USDC on Polygon
const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const lp_token_decimals = 6


async function main() {

	await depolyIndex( "Rebal/MeanRev/TrendFollow [BTC]", [
		{ name: "pool01v4a", weight: 1 },
		{ name: "pool03v4a", weight: 1 },
		{ name: "pool05v4a", weight: 1 },
	])

	await depolyIndex( "Rebal/MeanRev/TrendFollow [ETH]", [
		{ name: "pool02v4a", weight: 1 },
		{ name: "pool04v4a", weight: 1 },
		{ name: "pool06v4a", weight: 1 },
	])

	await depolyIndex( "Rebal/MeanRev/TrendFollow [BTC+ETH]", [
		{ name: "pool01v4a", weight: 1 },
		{ name: "pool02v4a", weight: 1 },
		{ name: "pool03v4a", weight: 1 },
		{ name: "pool04v4a", weight: 1 },
		{ name: "pool05v4a", weight: 1 },
		{ name: "pool06v4a", weight: 1 },
	])

	await depolyIndex("Rebal [BTC + ETH]", [
		{ name: "pool01v4a", weight: 1 },
		{ name: "pool02v4a", weight: 1 },
	])

	await depolyIndex("MeanRev [BTC + ETH]", [
	  { name: "pool03v4a", weight: 1 },
	  { name: "pool04v4a", weight: 1 },
	])

	await depolyIndex( "TrendFollow [BTC + ETH]", [
	  { name: "pool05v4a", weight: 1 },
	  { name: "pool06v4a", weight: 1 },
	])

}


async function depolyIndex(name: string, pools: Array<Pool>) {

	console.log("Starting deployment of IndexV4: ", name, "on POLYGON")

	const IndexV4 = await ethers.getContractFactory("IndexV4");
	const IndexLPToken = await ethers.getContractFactory("IndexLPToken");

	const indexLPToken = await IndexLPToken.deploy("HashStrat LP", "HSLP", lp_token_decimals)
	
	await indexLPToken.deployed()
	console.log("LPToken deployed at address:", indexLPToken.address);

	const index = await IndexV4.deploy(usdcAddress, indexLPToken.address);
	await index.deployed();
	console.log("IndexV4 deployed at address:", index.address);
	await delay(10_000);

	// add Index as minter to IndexLP
	await indexLPToken.addMinter(index.address)
	console.log("added minter to IndexLP token");
	await delay(10_000);

	// add pools
	for (var pool of pools) {
		const info = polygonPools[pool.name]
		// const name = pool.name.replace(/^./, pool.name[0].toUpperCase())
		console.log("adding pool ", pool.name, info.pool, info.pool_lp, pool.weight)

		await index.addPool(pool.name, info.pool, info.pool_lp, pool.weight)

		console.log("waining 10 secs...") 
		await delay(10_000);
	}

	console.log("Completed IndexV4 deployment")
}



// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});


function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

type Pool = {
	name: keyof typeof polygonPools;
	weight: number;
};


const polygonPools = {

	"pool01v4a": {
		"pool": "0x650056Eb11f9cb68427e2bf4107B9de431848059",
		"pool_lp": "0x4c7310bfDD5D79BB62FB58E2886a6a54b227276A",
		"strategy": "0x21c1c5262FB2A51Adefa78a4441De700F6874C21",
		"price_feed": "0xc907E116054Ad103354f2D350FD2514433D57F6f"
	},
	"pool02v4a": {
		"pool": "0x821555f905c342980539A7904c3bD436855E89b0",
		"pool_lp": "0x452d065A0e00f268884900ea2E079f9589bf29A4",
		"strategy": "0x0Bf7f645898eBbE27555d85C00aeb45Bd4a40Dd1",
		"price_feed": "0xF9680D99D6C9589e2a93a78A04A279e509205945"
	},
	"pool03v4a": {
		"pool": "0xa1f2B57e0f9D0804bFE4F4d40eC7c076915D98a9",
		"pool_lp": "0x252ac8bb8e22FD6dCDcA6C6926479fDBcF0D9C0f",
		"strategy": "0xAbA4e06B1E05D7D0b0F8B1fA8d157E487AB3697F",
		"price_feed": "0xc907E116054Ad103354f2D350FD2514433D57F6f"
	},
	"pool04v4a": {
		"pool": "0x236551ca7f59Cfa1253A22c4BdE172F4d05B2896",
		"pool_lp": "0xE032c00b3a993EA6245c1cCf37F52E8E279BeFB1",
		"strategy": "0xFAa9A19AFbeB0A41Ef91b3672866ba3a7718325c",
		"price_feed": "0xF9680D99D6C9589e2a93a78A04A279e509205945"
	},
	"pool05v4a": {
		"pool": "0x0cd1840Ae5297fbbA95b4E411D58aD1F07f9a02E",
		"pool_lp": "0x12c3830Cb5e1239295daD165EEd98EB333bd74D2",
		"strategy": "0xdc49e814E6CbF19F0b02b7A4FE96809216f13DE6",
		"price_feed": "0xc907E116054Ad103354f2D350FD2514433D57F6f"
	},
	"pool06v4a": {
		"pool": "0x06976dA5662E7E7787e86156EB0AcA5B29514499",
		"pool_lp": "0x2878AdE2DF7653E3BF58e735B2cf1AaCa435cE49",
		"strategy": "0x95E95d740F28aF508d51591064392CE61fcBEF9E",
		"price_feed": "0xF9680D99D6C9589e2a93a78A04A279e509205945"
	},
}
