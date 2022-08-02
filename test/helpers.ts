import { BN } from 'bn.js';
import { ethers } from "hardhat";
import { BigNumber } from "ethers";

export const round = (n : number, d=2) => {
    return Math.round(n * (10**d)) / (10**d)
}

// fromWei = (v, d=18) => {
//     if (d==18) return web3.utils.fromWei(v , 'ether')
//     if (d==9) return web3.utils.fromWei(v , 'gwei')
//     if (d==6) return web3.utils.fromWei(v , 'mwei')

//     return v / new BN(10 ** d)
// }

// toWei = (v, d=18) => {
//     if (d==18) return web3.utils.toWei(v , 'ether')
//     if (d==9) return web3.utils.toWei(v , 'gwei')
//     if (d==6) return web3.utils.toWei(v , 'mwei')

//     return v * new BN(10 ** d)
// }

export const fromUsdc = (v: BigNumber) => {
    return Number(ethers.utils.formatUnits(v , 'mwei'))
}

export const toUsdc = (v: number) => {
    return ethers.utils.formatUnits(v, "mwei");
   
}


// const increaseTime = addSeconds => { 

//     const packet = {
//       jsonrpc: "2.0",
//       method: "evm_increaseTime",
//       params: [addSeconds],
//       id: new Date().getTime()
//     };
  
//     return new Promise((resolve, reject) => {
//       web3.currentProvider.send(packet, (err, res) => {
//         if (err !== null) return reject(err);
//         return resolve(res);
//       });
//     });
// }

