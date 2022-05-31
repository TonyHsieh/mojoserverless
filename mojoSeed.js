'use strict'
const AWS = require('aws-sdk')
const ethers = require('ethers')
const merkleTreeJS = require('merkletreejs')
const solidityKeccak256 = require("ethers/lib/utils").solidityKeccak256;
const keccak256 = require("keccak256");

//-------------------------------
module.exports.claimMojoSeed = async (event) => {
  // ------------ 
  // walletAddress 
  const walletId = event.pathParameters.addr;
  // TEST - This for testing locally
  //const walletId = "0xd102030405060708091011121314151617181920"; // must be a string!
  const walletKey = "WALLET#" + walletId;
  
  const dynamodb = new AWS.DynamoDB.DocumentClient();
  let statusCodeVal = 200;
  let bodyVal = { message : "Not found" }; 

  console.log("0 =====================");
  console.log("walletId: " + walletId);
  console.log("walletKey: " + walletKey);

  /*
   * This is the expensive SCAN but useful for checking things...
  const scanParams = {
    TableName: process.env.DYNAMODB_WHITELIST_TABLE,
  };
  console.log("scanParams: ", scanParams);
  const result = await dynamodb.scan(scanParams).promise(); // This should be only 1 address! 
  if (result.Count === 0) {
    return {
      statusCode: 404
    }
  } else {
    console.log("1 =====================");
    console.log("Item found!");
    console.log("count: " + result.Count);
    console.log("Success", result.Items);
    console.log("2 =====================");
  }
  */


  // This is the way we need to grab the information
  //   The Wallet can exist in multiple Sales
  //   So we need this.
  //   Also this will be the way we do the extraction for the merkel leaves.
  //    from the salesKey-index
  const scanParams = {
    TableName: process.env.DYNAMODB_WHITELIST_TABLE,
    KeyConditionExpression: "#walletKey = :walletKey and begins_with(#saleKey, :saleKeyPrefix)",
    // NOTE:: begins_with() doesn't work with Parition Key -- KeyConditionExpression: "begins_with(#walletKey, :walletKey) and begins_with(#saleKey, :saleKeyPrefix)",
    ExpressionAttributeNames:{
      "#walletKey": "walletKey", 
      "#saleKey": "saleKey"
    }, 
    ExpressionAttributeValues: { 
      ':walletKey' : walletKey, // this uses the input from caller.
      ':saleKeyPrefix' : "SALE#", 
    },
    ProjectionExpression: 'saleKey, walletId, saleId, walletOrder', 
  };

  console.log("scanParams: ", scanParams);

  const result = await dynamodb.query(scanParams).promise();
  if (result.Count != 0) {
    console.log("1 =====================");
    console.log("Item found!", JSON.stringify(result, null, ));

    console.log(result.Items);
    const maxSaleId = parseInt(result.Items[result.Count - 1].saleId);
    console.log("max saleId: " + maxSaleId);
    const maxSaleKey = result.Items[result.Count - 1].saleKey;
    console.log("max saleKey: " + maxSaleKey);
    
    console.log("2 =====================");
    // PASTE IN THE MERKLE CODE !!!
    // ------------ 
    // 
    // There need to be get the list of the WalletAddresses from the SaleKey.
    const scanLeafParams = {
      TableName: process.env.DYNAMODB_WHITELIST_TABLE,
      IndexName: "saleKey-index",
      KeyConditionExpression: "#saleKey = :saleKey",
      ExpressionAttributeNames:{
        "#saleKey": "saleKey"
      }, 
      ExpressionAttributeValues: { 
        ':saleKey' : maxSaleKey, 
      },
      ProjectionExpression: 'walletId', 
    };
    console.log("scanLeafParams: ", scanLeafParams);
    // This will be the leaf nodes of the Merkel Tree
    const leafArray = await dynamodb.query(scanLeafParams).promise();
    if (leafArray.Count != 0) {

      console.log("3 ===================");
      console.log("Items found!", JSON.stringify(leafArray, null, ));

      console.log(leafArray.Items);
      // generate Merkle Leaves
      //const testArray = [ { walletId: '0x25DCa018694960CfB1206f255874302706470599' }, { walletId: '0xf102030405060708091011121314151617181920' }, { walletId: '0x6efa7b45769842f83C926F4403d8a8417596E90B' } ];
      //console.log(testArray);
      //const merkleLeaves = testArray.map((x) => 
      const merkleLeaves = leafArray.Items.map((x) => 
        { return solidityKeccak256(["address"], [x.walletId]) } ); 
      console.log("4 ===================");
      console.log("MerkleLeaves!", merkleLeaves);


      /*
      const test2Array = [ '0x25DCa018694960CfB1206f255874302706470599', '0xf102030405060708091011121314151617181920', '0x6efa7b45769842f83C926F4403d8a8417596E90B'];
      const merkle2Leaves = test2Array.map((address) => 
        { console.log ("  ***  " + address);
          return solidityKeccak256(["address"], [address.toString()]) } ); 
      console.log("Merkle2Leaves!", merkle2Leaves);

      console.log("another test: " + ethers.utils.solidityKeccak256([ "address" ], [ '0xf102030405060708091011121314151617181920', ]))
      console.log("another test: " + solidityKeccak256([ "address" ], [ '0xf102030405060708091011121314151617181920', ]))
      console.log("another test: " + keccak256( '0xf102030405060708091011121314151617181920' ).toString());
      console.log("another test: " ,  '0x' + keccak256('0xf102030405060708091011121314151617181920').toString("hex"));

      console.log(ethers.constants.HashZero);
      */
      // calculate the MerkleTree
      const merkleTree = new merkleTreeJS.MerkleTree(merkleLeaves, keccak256, { sort: true, fillDefaultHash: ethers.constants.HashZero });
      console.log("MerkelTree: ", merkleTree);

      // calculate the Leaf
      //
      const leaf = solidityKeccak256(["address"], [walletId]);
      console.log("leaf: ", leaf);

      // calculate the MerkleProof
      //
      const merkleProof = merkleTree.getHexProof(leaf);
      console.log("merkleProof: ", merkleProof);

      
      bodyVal = { 
        saleId: maxSaleId,
        merkleProof: merkleProof,
        address: walletId,
      };

    } else {
      console.log("3.1 ====  ERROR!!!!  Not Found ===");
    }
  } else {
    console.log ("0.1 === Nothing found ===  ");
  }

/*
 * THIS IS FOR getting a singular item with a "expected" UNIQUE Partition Key - which these are NOT!
  const scanParams = {
    TableName: process.env.DYNAMODB_WHITELIST_TABLE,
    Key: {
      walletKey: walletKey,
      saleKey: "SALE#000001", 
    },
  };
  console.log("scanParams: ", scanParams);
  const result = await dynamodb.get(scanParams).promise();
  if (result.Item) {
      console.log("1 =====================");
      console.log("Item found!", JSON.stringify(result, null, ));
    
      console.log(result.Item);
      console.log("2 =====================");
      // PASTE IN THE MERKLE CODE !!!
      // ------------ 
      // 
      // There need to be get the list of the WalletAddresses from the SaleKey.
      // This will be the leaf nodes of the Merkel Tree
      //
      //
      bodyVal = { message : "found"};
  } else {
      console.log ("0.1 === Nothing found ===  ");
  }
  */ 

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(bodyVal),
  };

}

//------------------------------

module.exports.getMojoSeed = async (event) => {

  // target of the UPDATE (put)
  const uuid = event.pathParameters.id;
  // for debugging locally 
  //const uuid = "3";
  
  let statusCodeVal = 200;
  let bodyVal = { message: "Not found" };

  // Look up the target Mojo  
  const scanParams = {
    TableName: process.env.DYNAMODB_MOJO_TABLE,
    Key: {
      uuid: uuid,
    },
  };
  console.log("0 =====================");
  console.log(JSON.stringify(scanParams));

  // The default return response
  const returnSeedMetaData = {
    external_url: "https://nft.planetmojo.io/mojos/" + uuid, 
    image: "https://images.planetmojo.io/Mojo_Seed_NFT.mp4",
  }
  console.log("0.1 =====================");
  console.log(JSON.stringify(returnSeedMetaData));

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const result = await dynamodb.get(scanParams).promise();

  if (result.Item) {
    const isSprouted = result.Item.isSprouted || false;
    console.log("2 =====================");
    console.log(isSprouted);
    console.log("3 =====================");

    // if sprouted then return 404
    if (isSprouted) {
      // if already sprouted then return 404
      statusCodeVal = 200;
      bodyVal = "{ }";
    } else {
      // if not sprouted then return the seed video 
      statusCodeVal = 200;
      bodyVal = returnSeedMetaData; 
    }
  }
  
  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(bodyVal),
  };
}




//------------------------------

module.exports.sproutMojoSeed = async (event) => {

  const apiKey = process.env.API_KEY;

  // ------------ 
  // target of the UPDATE (put)
  const uuid = event.pathParameters.id;
  // TEST - This for testing locally
  //const uuid = "3"; // must be a string!
  
  // The default return response
  const returnSeedMetaData = {
    external_url: "https://api.planetmojo.io/mojo-seed/metadata/" + uuid, 
    image: "https://image.planetmojo.io/Mojo_Seed_NFT.mp4"
  }

  // getting < something > from the input body. 
  //const body = JSON.parse(Buffer.from(event.body, 'base64').toString())
  
  const dynamodb = new AWS.DynamoDB.DocumentClient();

  let statusCodeVal = 200;
  let bodyVal = { message : "Not found" }; 

  const scanParams = {
    TableName: process.env.DYNAMODB_MOJO_TABLE,
    Key: {
      uuid: uuid,
    },
  };
  const result = await dynamodb.get(scanParams).promise();

  if (result.Item) {  
    console.log("1 =====================");
    console.log("Item found!");
    console.log("2 =====================");
    console.log("id: " + JSON.stringify(result.Item.uuid));
    console.log("isSprouted: " + JSON.stringify(result.Item.isSprouted));
    console.log("Date.now() vs nextCheckTime: " + Date.now() + " vs " + JSON.stringify(result.Item.nextCheckTime));
    // ------------ 
    // if isSprouted then do nothing and return a 200 
    // if NOT isSprouted and currentTime < nextCheckTime then do nothing and return (unrevealed) Seed Movie
    // if NOT isSprouted and currentTime > nextCheckTime then
    //          update the nextCheckTime to Date.now() plus 15 seconds (so you can't overcheck the contract)
    //          do a check (which costs money) for the SeedPlanted Contract 
    //          if isPlanted then update NFT to be isSprouted = Date.now()
    //          write out the value back to DynamoDB
    //
    if (result.Item.isSprouted) {
      console.log("2.1 ====isSprouted == TRUTHY =================");
      // if sprouted then return 200
      statusCodeVal = 200;
    } else if (Date.now() < result.Item.nextCheckTime) {
      console.log("2.1 ==== isSprouted == Not TRUTHY + not ready to check yet =================");
      // return the cached results
      statusCodeVal = 200;
    } else {
      console.log("2.2 ==== isSprouted == Not TRUTHY + READY to check NOW =================");
      // if not sprouted and enough time has elapse then check the sprouterContract. 

      const isPlanted = await callContractIsSeedPlanted(uuid); 

      console.log("3 =====================");
      console.log("isPlanted = " + isPlanted);

      // update nextCheckTime to Date.now() + (15 second * 1000 ms)
      result.Item.nextCheckTime = Date.now() + (15 * 1000);

      statusCodeVal = 200;

      // ifPlanted but not Sprouted then write new isSprouted to be true.
      if (isPlanted && !result.Item.isSprouted) {
        //Add the information here.
        result.Item.isSprouted = Date.now();
        bodyVal = { message: "Sprouting Complete"}; 
      }

      console.log("4 =====================");
      await putIntoDynamoDB(dynamodb, result.Item); 
      console.log("5 =====================");

    } 
  }

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(bodyVal),
  };



  // --------
  async function retrieveFromDynamoDB(_dynamodb, _uuid) {
    console.log("**** Entering retrieveFromDynamoDB");

    // Look up the target Mojo  
    const scanParams = {
      TableName: process.env.DYNAMODB_MOJO_TABLE,
      Key: {
        uuid: _uuid,
      },
    };

    return (_dynamodb.get(scanParams)).promise();
  }


  // --------
  async function putIntoDynamoDB(_dynamodb, _body) {
    console.log("**** Entering putIntoDynamoDB");

    console.log("4.1 =====================");
    console.log(JSON.stringify(_body));

    const putParams = {
      TableName: process.env.DYNAMODB_MOJO_TABLE, 
      Item: _body, 
    }
    return await (_dynamodb.put(putParams)).promise();
  }


  // --------
  async function callContractIsSeedPlanted(_id) {

    console.log("**** Entering callContractIsSeedPlanted");

    // Prepare for callins the Contract's isSeedPlanted
    const provider = new ethers.providers.JsonRpcProvider('https://polygon-mainnet.g.alchemy.com/v2/'+ apiKey);
    const sprouterContractAddress = "0x34bff0c8eC197D72c4cb95Ee5a8Be9644FED5022";
    const sprouterContract = new ethers.Contract(
      sprouterContractAddress, 
      [ "function isSeedPlanted(uint256) external view returns(bool)" ], 
      provider
    );

    // if not sprouted and enough time has elapse then check the sprouterContract. 
    return (sprouterContract.isSeedPlanted(_id));
    
  } 
}
