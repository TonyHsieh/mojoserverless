'use strict'
const AWS = require('aws-sdk')
const ethers = require("ethers");

module.exports.testEthers = async (event) => {

  const domain = {
      name: 'Planet Mojo',
      version: '0.1.0',
      //Polygon is 137
    chainId: 137
  };

  const types = {
    Action: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'action', type: 'string' },
    ]
  };

  const message = {
    tokenId: 1,
    action: 'sprout-mojo'
  };

  const sign = async (domain, types, message, signer) => {
    let signature = await signer._signTypedData(domain, types, message);

    const signedByAddress = ethers.utils.verifyTypedData(domain, types, message, signature)

    const isSignerMatching = !!(signedByAddress === signer.address); 
    
    console.log("user address", signer.address);
    console.log("signedByAddress", signedByAddress);

    return signature;
  };

  const wallet = ethers.Wallet.createRandom();

  const signature = await sign(
      domain,
      types,
      message, 
      wallet
    );

  console.log("signature", signature);
  
  const signedByAddress = ethers.utils.verifyTypedData(domain, types, message, signature)

  console.log("signedByAddress: "+ signedByAddress);

  return {
    statusCode: 200,
    body: "Nothing"
  };
}

