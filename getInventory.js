'use strict'
const AWS = require('aws-sdk')
const ALCHEMY = require("@alch/alchemy-web3")
// alchemy-nft-api/alchemy-web3-script.js
//import { createAlchemyWeb3 } from "@alch/alchemy-web3";

module.exports.getInventory = async (event) => {
  // alchemy-nft-api/alchemy-web3-script.js
  //import { createAlchemyWeb3 } from "@alch/alchemy-web3";

  // Replace with your Alchemy api key:
  const apiKey = "C4tFKEm_iQYtmsas8uqsG2tE1NwbruHE";

  // Initialize an alchemy-web3 instance:
  const web3 = ALCHEMY.createAlchemyWeb3(
		  `https://eth-mainnet.alchemyapi.io/v2/${apiKey}`,
		  );

  // The wallet address we want to query for NFTs:
  const ownerAddr = event.pathParameters.walletAddr;
  const nfts = await web3.alchemy.getNfts({owner: ownerAddr});

  // Print owner's wallet address:
  console.log("fetching NFTs for address:", ownerAddr);
  console.log("...");

  // Print total NFT count returned in the response:
  console.log("number of NFTs found:", nfts.totalCount);
  console.log("...");

  // Print contract address and tokenId for each NFT:
  for (const nft of nfts.ownedNfts) {
	  console.log("===");
	  console.log("contract address:", nft.contract.address);
	  console.log("token ID:", nft.id.tokenId);
  }
  console.log("===");


  return {
    statusCode: 200,
    //body: JSON.stringify(nfts),
    body: JSON.stringify({
	total: nfts.totalCount,
	items: await nfts.ownedNfts.map(nft => {
	  return {
	  contract: nft.contract.address,
	  tokenID: nft.id.tokenId,
	  }
	})
    })
  };
}
