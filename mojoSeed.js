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

      console.log(bodyVal);

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
    name: "Moj-Seed",
    description: "Plant this Moj-Seed to Sprout a Mojo.",
    external_url: "https://nft.planetmojo.io", 
    image: "https://images.planetmojo.io/Mojo_Seed.png",
    animation_url: "https://images.planetmojo.io/Mojo_Seed_NFT.mp4",
  }
  console.log("0.1 =====================");
  console.log(JSON.stringify(returnSeedMetaData));

  /*
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
  */
  
  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(returnSeedMetaData),
  };
}

//------------------------------

module.exports.plantTree = async (event) => {

  //target of Update (put)
  const walletId = event.pathParameters.addr;
  const treeLocation = event.pathParameters.treeLocation;

  console.log ("pathParameters: ", event.pathParameters);
  //TEST
  //const walletId = "0xd102030405060708091011121314151617181920";
  //const treeLocation = "NorthAmerica";

  console.log ("walletId: "+ walletId);
  console.log ("treeLocation: " + treeLocation);


  const walletKey = "WALLET#" + walletId;

  const dynamodb = new AWS.DynamoDB.DocumentClient();

  let statusCodeVal = 200;
  let bodyVal = { message: "Not Found" };

  const dateNow = Date.now();

  // Make sure the wallet is tied to a sale at least
  const queryParams = {
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
    ProjectionExpression: 'saleKey, saleId', 
  };

  console.log("queryParams: ", queryParams);
  const result = await dynamodb.query(queryParams).promise();
  if (result.Count != 0) {
    console.log("1 =======================");
    console.log("  Found existing WalletAddress");

    var updateParams = {
      TableName: process.env.DYNAMODB_WHITELIST_TABLE,
      Key: { 
        walletKey : walletKey, 
        saleKey  : "TREE#" + dateNow,
      },
      UpdateExpression: 'set #walletId = :walletId, #treeId = :treeId, #treeLocation = :treeLocation',
      //ConditionExpression: '#a < :MAX',
      ExpressionAttributeNames: {
        '#walletId' : 'walletId',
        '#treeId' : 'treeId',
        '#treeLocation' : 'treeLocation',
      },
      ExpressionAttributeValues: {
        ':walletId'     : walletId,
        ':treeId'       : dateNow,
        ':treeLocation' : treeLocation,
      },
      ReturnValues: "ALL_NEW"
    };

    console.log("updateParams: ", updateParams);

    console.log(await dynamodb.update(updateParams).promise());
    bodyVal = { message: "Recorded" };
  } else {
    console.log("Wallet doesn't exist: ", walletId);
  }

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(bodyVal),
  };


}

//------------------------------
/*
module.exports.testCopy = async (event) => {


  // ------------ 
  // target of the UPDATE (put)
  const uuid = event.pathParameters.id;
  // TEST - This for testing locally
  //const uuid = "1"; // must be a string!

  const DIR_KEY = process.env.DIR_KEY;
  let imagesURL = "xx";
  console.log("process.env.AWS_LAMBDA_FUNCTION_NAME: ", process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (process.env.AWS_LAMBDA_FUNCTION_NAME.indexOf("prod") != -1) {
    console.log("   Choose PROD images!");
    imagesURL = "planetmojo.io"; // PRODUCTION
  } else {
    console.log("   Choose DEV images!");
    imagesURL = "hsieh.org"; // DEV
  }

  const s3 = new AWS.S3();
  const bucket = process.env.S3_PLANETMOJO_IMAGES;

  const imagePNGfilename = "mojo_"+ uuid.toString().padStart(6,'0') + ".png";
  const imageMP4filename = "mojo_"+ uuid.toString().padStart(6,'0') + ".mp4";

  const paramsPNG = {
    Bucket: bucket, 
    CopySource: bucket + "/" + DIR_KEY + "/" + imagePNGfilename, 
    Key: imagePNGfilename 
  };
  console.log("=== PNG COPY ===");
  console.log("PNG copy: params:: "  + JSON.stringify(paramsPNG));
  const resultPNG = await s3.copyObject(paramsPNG).promise();
  console.log("PNG copy: " + resultPNG);

  let paramsMP4 = {
    Bucket: bucket, 
    CopySource: bucket + "/" + DIR_KEY + "/" + imageMP4filename, 
    Key: imageMP4filename 
  };
  console.log("=== MP4 COPY ===");
  console.log("MP4 copy: params:: "  + JSON.stringify(paramsMP4));
  const resultMP4 = await s3.copyObject(paramsMP4).promise();
  console.log("MP4 copy: " + resultMP4);

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify("TEST DONE"),
  };
}
*/

//------------------------------

module.exports.sproutMojoSeed = async (event) => {

  const apiKey = process.env.API_KEY;

  // ------------ 
  // target of the UPDATE (put)
  const uuid = event.pathParameters.id;
  // TEST - This for testing locally
  //const uuid = "1"; // must be a string!
  
  // The default return response
  const returnSeedMetaData = {
    external_url: "https://api.planetmojo.io/mojo-seed/metadata/" + uuid, 
    image: "https://images.planetmojo.io/Mojo_Seed_NFT.mp4"
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
    //          do a check (which costs money) for the SeedPlanted Contract and the MojoExists Contract
    //          if isPlanted || isMojoExists then update NFT to be isSprouted = Date.now()
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

      console.log("3 =====================");
      const isPlanted = await callContractIsSeedPlanted(uuid); 
      console.log("isPlanted = " + isPlanted);

      //TEMP WORKAROUND
      //const isMojoExists = false;
      const isMojoExists = await callMojoContract(uuid);
      console.log("isMojoExists = " + isMojoExists);

      // update nextCheckTime to Date.now() + (15 second * 1000 ms)
      result.Item.nextCheckTime = Date.now() + (15 * 1000);

      statusCodeVal = 200;

      // ifPlanted but not Sprouted then write new isSprouted to be true.
      if ((isPlanted || isMojoExists) && !result.Item.isSprouted) {
        console.log("4 =====================");
        //Add the information here.
        result.Item.isSprouted = Date.now();
        console.log("5 =====================");
        
        //Copy the files from DIR_KEY to root
        const DIR_KEY = process.env.DIR_KEY;
        let imagesURL = "xx";
        console.log("process.env.AWS_LAMBDA_FUNCTION_NAME: ", process.env.AWS_LAMBDA_FUNCTION_NAME);
        if (process.env.AWS_LAMBDA_FUNCTION_NAME.indexOf("prod") != -1) {
          console.log("   Choose PROD images!");
          imagesURL = "planetmojo.io"; // PRODUCTION
        } else {
          console.log("   Choose DEV images!");
          imagesURL = "hsieh.org"; // DEV
        }

        const s3 = new AWS.S3();
        const bucket = process.env.S3_PLANETMOJO_IMAGES;

        const imagePNGfilename = "mojo_"+ uuid.toString().padStart(6,'0') + ".png";
        const imageMP4filename = "mojo_"+ uuid.toString().padStart(6,'0') + ".mp4";

        const paramsPNG = {
          Bucket: bucket, 
          CopySource: bucket + "/" + DIR_KEY + "/" + imagePNGfilename, 
          Key: imagePNGfilename 
        };

        console.log("=== PNG COPY ===");
        console.log("PNG copy: params:: "  + JSON.stringify(paramsPNG));
        const resultPNG = await s3.copyObject(paramsPNG).promise();
        console.log("PNG copy: " + resultPNG);

        let paramsMP4 = {
          Bucket: bucket, 
          CopySource: bucket + "/" + DIR_KEY + "/" + imageMP4filename, 
          Key: imageMP4filename 
        };
        console.log("=== MP4 COPY ===");
        let resultMP4 = "";
        try {
          console.log("MP4 copy: params:: "  + JSON.stringify(paramsMP4));
          resultMP4 = await s3.copyObject(paramsMP4).promise();
        } catch (err) {
          console.log("suppress:" + err);
        }
        console.log("MP4 copy: " + resultMP4);

        bodyVal = { message: "Sprouting Complete"}; 
      }

      console.log("6 =====================");
      await putIntoDynamoDB(dynamodb, result.Item); 
      console.log("7 =====================");

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
    //const provider = new ethers.providers.JsonRpcProvider('https://polygon-mainnet.g.alchemy.com/v2/'+ apiKey);
    console.log("_id = " + _id);
    let providerURL = "xx";
    let sprouterContractAddress = "xx"; 

    console.log("process.env.AWS_LAMBDA_FUNCTION_NAME: ", process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (process.env.AWS_LAMBDA_FUNCTION_NAME.indexOf("prod") != -1) {
      console.log("   Choose PROD sprouter contract!");
      providerURL = "https://polygon-mainnet.g.alchemy.com/v2/"; // PRODUCTION
      sprouterContractAddress = "0xCdD0A312C148e1cd449FcD8e7aaF186dF6A1a691"; // PRODUCTION
    } else {
      console.log("   Choose DEV sprouter contract!");
      providerURL = "https://polygon-mumbai.g.alchemy.com/v2/"; // DEV 
      sprouterContractAddress = "0xAf76c6F88520Db4aF9a0a643E88A4e4e1537Ad7e"; // DEV
    }
    
    const provider = new ethers.providers.JsonRpcProvider(providerURL + apiKey);
    console.log("Provider: ", providerURL);
    console.log("Sprouter contract: ", sprouterContractAddress);
    const sprouterContract = new ethers.Contract(
      sprouterContractAddress, 
      [ "function isSeedPlanted(uint256) external view returns(bool)" ], 
      provider
    );

    // if not sprouted and enough time has elapse then check the sprouterContract. 
    return (sprouterContract.isSeedPlanted(_id));
  }

  // --------
  async function callMojoContract(_id) {

    console.log("**** Entering callMojoContract");
    // Prepare for callins the Contract's isSeedPlanted
    //const provider = new ethers.providers.JsonRpcProvider('https://polygon-mainnet.g.alchemy.com/v2/'+ apiKey);
    console.log("_id = " + _id);
    let providerURL = "xx";
    let mojoContractAddress = ""; 
    
    console.log("process.env.AWS_LAMBDA_FUNCTION_NAME: ", process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (process.env.AWS_LAMBDA_FUNCTION_NAME.indexOf("prod") != -1) {
      console.log("   Choose PROD mojo contract!");
      providerURL = "https://polygon-mainnet.g.alchemy.com/v2/"; // PRODUCTION
      mojoContractAddress = "0x43f2932341c1F619648c7A077b49393Ca882b4d1"; // PRODUCTION
    } else {
      console.log("   Choose DEV mojo contract!");
      providerURL = "https://polygon-mumbai.g.alchemy.com/v2/"; // DEV 
      mojoContractAddress = "0x7Ed9a5D4Af51AC4D2A3F798a62e75fE79Eccfa95"; // DEV
    }

    const provider = new ethers.providers.JsonRpcProvider(providerURL + apiKey);
    console.log("Provider: ", providerURL);
    console.log("Mojo contract: ", mojoContractAddress);

    const mojoContract = new ethers.Contract(
      mojoContractAddress,
      [ "function exists(uint256 tokenId) external view returns (bool)"],
      provider
    );
    console.log("Mojo contract innards: ", mojoContract);

    // if not sprouted and enough time has elapse then check the mojoContract. 
    return (mojoContract.exists(_id));
    
  } 
}
//-------------------------------

/*
module.exports.unboxChampion = async (event) => {

  const apiKey = process.env.API_KEY;

  // ------------
  // This is the additional offset
  const idOffset = 0;
  //const idOffset = 5000;
  let temp_uuid = parseInt(event.pathParameters, 10) + idOffset;
  
  // ------------ 
  // target of the UPDATE (put)
  const uuid = temp_uuid.toString();
  // TEST - This for testing locally
  //const uuid = "1"; // must be a string!
  
  // The default return response
  const returnChampionMetaData = {
    external_url: "https://api.planetmojo.io/champion/metadata/" + uuid, 
    image: "https://images.planetmojo.io/ChampionChest.mp4"
  };

  // getting < something > from the input body. 
  //const body = JSON.parse(Buffer.from(event.body, 'base64').toString())
  
  const dynamodb = new AWS.DynamoDB.DocumentClient();

  let statusCodeVal = 200;
  let bodyVal = { message : "Not found" }; 


  const scanParams = {
    TableName: process.env.DYNAMODB_CHAMPION_TABLE, Key: {
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
    //          do a check (which costs money) for the SeedPlanted Contract and the MojoExists Contract
    //          if isPlanted || isMojoExists then update NFT to be isSprouted = Date.now()
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

      console.log("3 =====================");
      const canUnbox = await callContractCanUnbox(uuid); 
      console.log("canUnbox = " + canUnbox);

      //TEMP WORKAROUND
      //const isMojoExists = false;
      const isChampionExists = await callChampionContract(uuid);
      console.log("isChampionExists = " + isChampionExists);

      // update nextCheckTime to Date.now() + (15 second * 1000 ms)
      result.Item.nextCheckTime = Date.now() + (15 * 1000);

      statusCodeVal = 200;

      // ifPlanted but not Sprouted then write new isSprouted to be true.
      if ((canUnox || isChampionExists) && !result.Item.isSprouted) {
        console.log("4 =====================");
        //Add the information here.
        result.Item.isSprouted = Date.now();
        console.log("5 =====================");
       
        /*  -- this is the copy of the hidden image to the revealed image -- 

        //Copy the files from DIR_KEY to root
        const DIR_KEY = process.env.DIR_KEY;
        let imagesURL = "xx";
        console.log("process.env.AWS_LAMBDA_FUNCTION_NAME: ", process.env.AWS_LAMBDA_FUNCTION_NAME);
        if (process.env.AWS_LAMBDA_FUNCTION_NAME.indexOf("prod") != -1) {
          console.log("   Choose PROD images!");
          imagesURL = "planetmojo.io"; // PRODUCTION
        } else {
          console.log("   Choose DEV images!");
          imagesURL = "hsieh.org"; // DEV
        }

        const s3 = new AWS.S3();
        const bucket = process.env.S3_PLANETMOJO_IMAGES;

        const imagePNGfilename = "mojo_"+ uuid.toString().padStart(6,'0') + ".png";
        const imageMP4filename = "mojo_"+ uuid.toString().padStart(6,'0') + ".mp4";

        const paramsPNG = {
          Bucket: bucket, 
          CopySource: bucket + "/" + DIR_KEY + "/" + imagePNGfilename, 
          Key: imagePNGfilename 
        };

        console.log("=== PNG COPY ===");
        console.log("PNG copy: params:: "  + JSON.stringify(paramsPNG));
        const resultPNG = await s3.copyObject(paramsPNG).promise();
        console.log("PNG copy: " + resultPNG);

        let paramsMP4 = {
          Bucket: bucket, 
          CopySource: bucket + "/" + DIR_KEY + "/" + imageMP4filename, 
          Key: imageMP4filename 
        };
        console.log("=== MP4 COPY ===");
        let resultMP4 = "";
        try {
          console.log("MP4 copy: params:: "  + JSON.stringify(paramsMP4));
          resultMP4 = await s3.copyObject(paramsMP4).promise();
        } catch (err) {
          console.log("suppress:" + err);
        }
        console.log("MP4 copy: " + resultMP4);

        */
/*
        bodyVal = { message: "Sprouting Complete"}; 
      }

      console.log("6 =====================");
      await putIntoDynamoDB(dynamodb, result.Item); 
      console.log("7 =====================");

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
  async function callContractCanUnbox(_id) {

    console.log("**** Entering callContractCanUnbox");

    // Prepare for callins the Contract's canUnbox() 
    const provider = new ethers.providers.JsonRpcProvider('https://polygon-mainnet.g.alchemy.com/v2/'+ apiKey);
    let sprouterContractAddress = "xx"; 

    console.log("process.env.AWS_LAMBDA_FUNCTION_NAME: ", process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (process.env.AWS_LAMBDA_FUNCTION_NAME.indexOf("prod") != -1) {
      console.log("   Choose PROD sprouter contract!");
      sprouterContractAddress = "0xCdD0A312C148e1cd449FcD8e7aaF186dF6A1a691"; // PRODUCTION
    } else {
      console.log("   Choose DEV sprouter contract!");
      sprouterContractAddress = "0xb84528055ddA457a7f902742cd1cb5359C1064b9"; // DEV
    }
    
    console.log("Sprouter contract: ", sprouterContractAddress);
    const sprouterContract = new ethers.Contract(
      sprouterContractAddress, 
      [ "function canUnbox(uint256) external view returns(bool)" ], 
      provider
    );

    // if not sprouted and enough time has elapse then check the sprouterContract. 
    return (sprouterContract.canUnbox(_id));
  }

  // --------
  async function callChampionContract(_id) {

    console.log("**** Entering callChampionContract");

    // Prepare for callins the Contract's callChampionContract 
    const provider = new ethers.providers.JsonRpcProvider('https://polygon-mainnet.g.alchemy.com/v2/'+ apiKey);
    let championContractAddress = ""; 
    
    console.log("process.env.AWS_LAMBDA_FUNCTION_NAME: ", process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (process.env.AWS_LAMBDA_FUNCTION_NAME.indexOf("prod") != -1) {
      console.log("   Choose PROD mojo contract!");
      championContractAddress = "0x43f2932341c1F619648c7A077b49393Ca882b4d1"; // PRODUCTION
    } else {
      console.log("   Choose DEV mojo contract!");
      championContractAddress = "0x5BFA11B93a86816CAD05Ef3683aAda0cECA61f9A"; // DEV
    }
    console.log("Champion contract: ", championContractAddress);

    const championContract = new ethers.Contract(
      championContractAddress,
      [ "function exists(uint256 tokenId) external view returns (bool)"],
      provider
    );
    console.log("Champion contract innards: ", championContract);

    // if not sprouted and enough time has elapse then check the mojoContract. 
    return (championContract.exists(_id));
    
  } 
}
*/

//-------------------------------
module.exports.getMoviePoster = async (event) => {

  const uuid = event.pathParameters.id;
  // for debugging locally 
  //const uuid = "3";
  
  let statusCodeVal = 200;
  let bodyVal = { message: "Not found" };

  // Look up the target Mojo  
  //const scanParams = {
  //  TableName: process.env.DYNAMODB_MOJO_TABLE,
  //  Key: {
  //    uuid: uuid,
  //  },
  //};
  //console.log("0 =====================");
  //console.log(JSON.stringify(scanParams));

  let mojoURL = "";
  console.log("process.env.AWS_LAMBDA_FUNCTION_NAME: ", process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (process.env.AWS_LAMBDA_FUNCTION_NAME.indexOf("prod") != -1) {
    console.log("   Choose PROD mojo URL!");
    mojoURL = "https://nft.planetmojo.io"; // PRODUCTION
  } else {
    console.log("   Choose DEV mojo URL!");
    mojoURL = "https://develop.d4ptv3m4dtbv3.amplifyapp.com"; // DEV
  }
  console.log("0 =====================");
  console.log("Mojo URL: ", mojoURL);


  // The default return response
  const returnSeedMetaData = {
    uuid: uuid,
    image: "https://images.planetmojo.io/MojoTrailerPoster.jpg",
    name: "Planet Mojo Cinematic Collector's Pass",
    external_url: mojoURL + "/collectibles/cinematic-collectors-pass/" + uuid, 
    description: "A limited edition Cinematic Collector's Pass \"movie poster\" NFT created for the community in celebration of the release of Planet Mojo's first cinematic trailer!",
    attributes: [{ display_type: null, value: "Collector's Edition", trait_type: "Pass Type"}]
  }

  console.log("0.1 =====================");
  console.log(JSON.stringify(returnSeedMetaData));

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(returnSeedMetaData),
  };
}

//-------------------------------
module.exports.claimCollectible = async (event) => {
  // ------------ 
  // walletAddress 
  const walletId = event.pathParameters.addr;
  const walletId_lowercase = event.pathParameters.addr.toLowerCase();
  // TEST - This for testing locally
  //const walletId = "0xd102030405060708091011121314151617181920"; // must be a string!
  const walletKey = "WALLET#" + walletId;
  const walletKey_lowercase = "WALLET#" + walletId_lowercase;
  
  const dynamodb = new AWS.DynamoDB.DocumentClient();
  let statusCodeVal = 200;
  let bodyVal = { message : "Not found" }; 

  console.log("0 =====================");
  console.log("walletId: " + walletId);
  console.log("walletKey: " + walletKey);
  console.log("walletId - lowercase: " + walletId_lowercase);
  console.log("walletKey - lowercase: " + walletKey_lowercase);

  // This is the way we need to grab the information
  //   The Wallet can exist in multiple Sales
  //   So we need this.
  //   Also this will be the way we do the extraction for the merkel leaves.
  //    from the salesKey-index

  // == upper+lower case==
  const scanParams = {
    TableName: process.env.DYNAMODB_CLAIM_TABLE,
    KeyConditionExpression: "#walletKey = :walletKey and begins_with(#saleKey, :saleKeyPrefix)",
    // NOTE:: begins_with() doesn't work with Parition Key -- KeyConditionExpression: "begins_with(#walletKey, :walletKey) and begins_with(#saleKey, :saleKeyPrefix)",
    ExpressionAttributeNames:{
      "#walletKey": "PK", 
      "#saleKey": "SK"
    }, 
    ExpressionAttributeValues: { 
      ':walletKey' : walletKey, // this uses the input from caller.
      ':saleKeyPrefix' : "SALE#", 
    },
    ProjectionExpression: 'SK, walletId, saleId, saleKey, walletOrder, merkleProof', 
  };

  console.log("scanParams: ", scanParams);

  const result = await dynamodb.query(scanParams).promise();

  // == lowercase ==
  const scanParams_lowercase = {
    TableName: process.env.DYNAMODB_CLAIM_TABLE,
    KeyConditionExpression: "#walletKey = :walletKey and begins_with(#saleKey, :saleKeyPrefix)",
    // NOTE:: begins_with() doesn't work with Parition Key -- KeyConditionExpression: "begins_with(#walletKey, :walletKey) and begins_with(#saleKey, :saleKeyPrefix)",
    ExpressionAttributeNames:{
      "#walletKey": "PK", 
      "#saleKey": "SK"
    }, 
    ExpressionAttributeValues: { 
      ':walletKey' : walletKey_lowercase, // this uses the input from caller.
      ':saleKeyPrefix' : "SALE#", 
    },
    ProjectionExpression: 'SK, walletId, saleId, saleKey, walletOrder, merkleProof', 
  };

  console.log("scanParams_lowercase: ", scanParams_lowercase);

  const result_lowercase = await dynamodb.query(scanParams_lowercase).promise();
  
  if (result.Count > 0) {
    console.log("1 =====================");
    console.log("Item found!", JSON.stringify(result, null, ));

    console.log(result.Items);
    const maxSaleId = parseInt(result.Items[result.Count - 1].saleId);
    console.log("max saleId: " + maxSaleId);
    const maxSaleKey = result.Items[result.Count - 1].SK;
    console.log("max saleKey: " + maxSaleKey);
    const maxMerkleProof = result.Items[result.Count - 1].merkleProof;
    console.log("max merkleProof: " + maxMerkleProof);
    
    console.log("2 =====================");
    bodyVal = { 
      saleId: maxSaleId,
      merkleProof: maxMerkleProof,
      address: walletId,
    };
    console.log(bodyVal); 
  } else if (result_lowercase.Count > 0) {
    console.log("1 =====================");
    console.log("Item (lowercase) found!", JSON.stringify(result_lowercase, null, ));

    console.log(result_lowercase.Items);
    const maxSaleId = parseInt(result_lowercase.Items[result_lowercase.Count - 1].saleId);
    console.log("max saleId: " + maxSaleId);
    const maxSaleKey = result_lowercase.Items[result_lowercase.Count - 1].SK;
    console.log("max saleKey: " + maxSaleKey);
    const maxMerkleProof = result_lowercase.Items[result_lowercase.Count - 1].merkleProof;
    console.log("max merkleProof: " + maxMerkleProof);
    
    console.log("2 =====================");
    bodyVal = { 
      saleId: maxSaleId,
      merkleProof: maxMerkleProof,
      address: walletId,
    };
    console.log(bodyVal); 
  
  } else {
    console.log ("0.1 === Nothing found ===  ");
  }

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(bodyVal),
  };
}

//-------------------------------
module.exports.getVIPplaytestPass = async (event) => {

  const uuid = event.pathParameters.id;
  // for debugging locally 
  //const uuid = "3";
  
  let statusCodeVal = 200;
  let bodyVal = { message: "Not found" };

  // Look up the target Mojo  
  //const scanParams = {
  //  TableName: process.env.DYNAMODB_MOJO_TABLE,
  //  Key: {
  //    uuid: uuid,
  //  },
  //};
  //console.log("0 =====================");
  //console.log(JSON.stringify(scanParams));

  let mojoURL = "";
  let mojoImagesURL = "";
  console.log("process.env.AWS_LAMBDA_FUNCTION_NAME: ", process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (process.env.AWS_LAMBDA_FUNCTION_NAME.indexOf("prod") != -1) {
    console.log("   Choose PROD mojo URL!");
    mojoURL = "https://nft.planetmojo.io"; // DEV
    mojoImagesURL = "https://images.planetmojo.io"; // PRODUCTION
  } else {
    console.log("   Choose DEV mojo URL!");
    mojoURL = "https://develop.d4ptv3m4dtbv3.amplifyapp.com"; // DEV
    mojoImagesURL = "https://images.hsieh.org"; // DEV
  }
  console.log("0 =====================");
  console.log("Mojo URL: ", mojoURL);
  console.log("Mojo images URL: ", mojoImagesURL);


  // choose which color VIP playpass to use
  const colorId = Number(uuid) % 4;
  let colorString = "";
  switch (colorId) {
    case 0: 
      colorString = "Red";
      break;
    case 1: 
      colorString = "Green";
      break;
    case 2: 
      colorString = "Blue";
      break;
    case 3: 
      colorString = "Purple";
      break;
    default: console.log("Unknown colorId: "+ colorId);
  }

  // The default return response
  const returnSeedMetaData = {
    uuid: uuid,
    image: mojoImagesURL + "/VIP-Pass-NFT-" + colorString + ".png",
    name: "Mojo Melee VIP Playtest Pass",
    external_url: mojoURL + "/collectibles/vip-playtest-pass/" + uuid, 
    description: "The Mojo Melee VIP Playtest Pass NFT is a ticket that provides access to Pre-Alpha testing of Mojo Melee. Pass holders will have access to in-game rewards, a special badge and invitations to special events.",
    attributes: [
      { display_type: null, trait_type: "Pass Type", value: "Playtester"},
      { display_type: null, trait_type: "Access", value: "VIP"}, 
      { display_type: null, trait_type: "Game" , value: "Mojo Melee"}, 
      { display_type: null, trait_type: "Phase", value: "Pre-Alpha" }, 
      { display_type: null, trait_type: "Color", value: colorString }, 
    ]
  }

  console.log("0.1 =====================");
  console.log(JSON.stringify(returnSeedMetaData));

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(returnSeedMetaData),
  };
}

//-------------------------------
module.exports.getGoldenMojo = async (event) => {

  const uuid = event.pathParameters.id;
  // for debugging locally 
  //const uuid = "3";
  
  let statusCodeVal = 200;
  let bodyVal = { message: "Not found" };

  // Look up the target Mojo  
  //const scanParams = {
  //  TableName: process.env.DYNAMODB_MOJO_TABLE,
  //  Key: {
  //    uuid: uuid,
  //  },
  //};
  //console.log("0 =====================");
  //console.log(JSON.stringify(scanParams));

  let mojoURL = "";
  let mojoImagesURL = "";
  console.log("process.env.AWS_LAMBDA_FUNCTION_NAME: ", process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (process.env.AWS_LAMBDA_FUNCTION_NAME.indexOf("prod") != -1) {
    console.log("   Choose PROD mojo URL!");
    mojoURL = "https://nft.planetmojo.io"; // PRODUCTION
    mojoImagesURL = "https://images.planetmojo.io"; // PRODUCTION
  } else {
    console.log("   Choose DEV mojo URL!");
    mojoURL = "https://develop.d4ptv3m4dtbv3.amplifyapp.com"; // DEV
    mojoImagesURL = "https://images.hsieh.org"; // DEV
  }
  console.log("0 =====================");
  console.log("Mojo URL: ", mojoURL);
  console.log("Mojo images URL: ", mojoImagesURL);

  // color is Gold
  const colorString = "Gold";

  // The default return response
  const returnSeedMetaData = {
    uuid: uuid,
    image: mojoImagesURL + "/GoldenMojo.png",
    animation_url: mojoImagesURL + "/GoldenMojo.mp4",
    name: "Golden Mojo",
    external_url: mojoURL + "/collectibles/golden-mojo/" + uuid, 
    description: "The limited edition Golden Mojo represents participation in the inaugural Mojo Melee 2023 Mojo Bowl Tournament.",
    attributes: [
      { display_type: null, trait_type: "Pass Type", value: "Tournament"},
      { display_type: null, trait_type: "Reward", value: "Mojo Bowl"}, 
      { display_type: null, trait_type: "Game" , value: "Mojo Melee"}, 
      { display_type: null, trait_type: "Phase", value: "Alpha" }, 
      { display_type: null, trait_type: "Color", value: colorString }, 
    ]
  }

  console.log("0.1 =====================");
  console.log(JSON.stringify(returnSeedMetaData));

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(returnSeedMetaData),
  };
}

//-------------------------------
module.exports.getChampionChest = async (event) => {

  const uuid = event.pathParameters.id;
  // for debugging locally 
  //const uuid = "3";
  
  let statusCodeVal = 200;
  let bodyVal = { message: "Not found" };

  // Look up the target Mojo  
  //const scanParams = {
  //  TableName: process.env.DYNAMODB_MOJO_TABLE,
  //  Key: {
  //    uuid: uuid,
  //  },
  //};
  //console.log("0 =====================");
  //console.log(JSON.stringify(scanParams));

  let mojoURL = "";
  let mojoImagesURL = "";
  console.log("process.env.AWS_LAMBDA_FUNCTION_NAME: ", process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (process.env.AWS_LAMBDA_FUNCTION_NAME.indexOf("prod") != -1) {
    console.log("   Choose PROD mojo URL!");
    mojoURL = "https://nft.planetmojo.io"; // PRODUCTION
    //mojoImagesURL = "https://images.planetmojo.io"; // PRODUCTION
    mojoImagesURL = "https://planetmojo-images-prod.s3.amazonaws.com"; // PRODUCTION
  } else {
    console.log("   Choose DEV mojo URL!");
    mojoURL = "https://develop.d4ptv3m4dtbv3.amplifyapp.com"; // DEV
    //mojoImagesURL = "https://images.hsieh.org"; // DEV
    mojoImagesURL = "https://planetmojo-images-dev.s3.amazonaws.com"; // DEV
  }
  console.log("0 =====================");
  console.log("Mojo URL: ", mojoURL);
  console.log("Mojo images URL: ", mojoImagesURL);

  // color is Gold
  const colorString = "Gold";

  // The default return response
  const returnSeedMetaData = {
    uuid: uuid,
    image: mojoImagesURL + "/ChampionChest.gif",
    animation_url: mojoImagesURL + "/ChampionChest.mp4",
    name: "Champion Chest #" + uuid.toString().padStart(4, '0'),
    //external_url: mojoURL + "/collectibles/champion-chest/" + uuid, 
    external_url: mojoURL + "/collectibles", 
    description: "An Alpha Champion Chest holds one of four Planet Mojo Champions from the Alpha Generation. Planet Mojo Champions are unlocked in all Planet Mojo games for owners, provide Collection Points to unlock rewards faster and give access to other exclusive content.",
    attributes: [
      { display_type: null, trait_type: "Tier", value: "Alpha" }, 
    ]
  }

  console.log("0.1 =====================");
  console.log(JSON.stringify(returnSeedMetaData));

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(returnSeedMetaData),
  };
}

//-------------------------------
module.exports.getBetaChest = async (event) => {

  const uuid = event.pathParameters.id;
  // for debugging locally 
  //const uuid = "3";
  
  let statusCodeVal = 200;
  let bodyVal = { message: "Not found" };

  let mojoURL = "";
  let mojoImagesURL = "";
  console.log("process.env.AWS_LAMBDA_FUNCTION_NAME: ", process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (process.env.AWS_LAMBDA_FUNCTION_NAME.indexOf("prod") != -1) {
    console.log("   Choose PROD mojo URL!");
    mojoURL = "https://nft.planetmojo.io"; // PRODUCTION
    //mojoImagesURL = "https://images.planetmojo.io"; // PRODUCTION
    mojoImagesURL = "https://planetmojo-images-prod.s3.amazonaws.com"; // PRODUCTION
  } else {
    console.log("   Choose DEV mojo URL!");
    mojoURL = "https://develop.d4ptv3m4dtbv3.amplifyapp.com"; // DEV
    //mojoImagesURL = "https://images.hsieh.org"; // DEV
    mojoImagesURL = "https://planetmojo-images-dev.s3.amazonaws.com"; // DEV
  }
  console.log("0 =====================");
  console.log("Mojo URL: ", mojoURL);
  console.log("Mojo images URL: ", mojoImagesURL);

  // color is Gold
  const colorString = "Gold";

  // The default return response
  const returnSeedMetaData = {
    uuid: uuid,
    image: mojoImagesURL + "/BetaChest.gif",
    animation_url: mojoImagesURL + "/BetaChest.mp4",
    name: "Beta Chest #" + uuid.toString().padStart(4, '0'),
    //external_url: mojoURL + "/collectibles/beta-chest/" + uuid, 
    external_url: mojoURL + "/collectibles", 
    description: "The limited edition Mojo Melee Open Beta Chest is a reward for participation in the Mojo Melee Open Beta program. After being minted, this Chest will grant in-game rewards to the owner once unlocked inside of Mojo Melee.",
    attributes: [
      { display_type: null, trait_type: "Tier", value: "Beta" }, 
    ]
  }

  console.log("0.1 =====================");
  console.log(JSON.stringify(returnSeedMetaData));

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(returnSeedMetaData),
  };
}

//-------------------------------
module.exports.getWarBanner = async (event) => {

  const uuid = event.pathParameters.id;
  // for debugging locally 
  //const uuid = "3";
  
  let statusCodeVal = 200;
  let bodyVal = { message: "Not found" };

//  let mojoImagesURL = "";
//  console.log("process.env.AWS_LAMBDA_FUNCTION_NAME: ", process.env.AWS_LAMBDA_FUNCTION_NAME);
//  if (process.env.AWS_LAMBDA_FUNCTION_NAME.indexOf("prod") != -1) {
//    console.log("   Choose PROD mojo URL!");
//    mojoImagesURL = "https://planetmojo-images-prod.s3.amazonaws.com"; // PRODUCTION
//  } else {
//    console.log("   Choose DEV mojo URL!");
//    mojoImagesURL = "https://planetmojo-images-dev.s3.amazonaws.com"; // DEV
//  }
//  console.log("0 =====================");
//  console.log("Mojo images URL: ", mojoImagesURL);


  // The default return response
  const returnSeedMetaData = {
    name: "Planet Mojo: War Banner #" + uuid.toString().padStart(4, '0'),
    description: "The limited edition Planet Mojo War Banners are a Genesis Ecosystem NFT marking the next chapter for Planet Mojo. The War Banners will reveal 6 unique Clan Banners marking the original Clans of Planet Mojo.",
    //image: "https://planetmojo-images-prod.s3.amazonaws.com/banners/PlanetMojo-WarBanner.jpeg",
    //animation_url: "https://planetmojo-images-prod.s3.amazonaws.com/banners/PlanetMojo-WarBanner.mp4",
    image: "PlanetMojo-WarBanner.jpeg",
    animation_url: "PlanetMojo-WarBanner.mp4",
    attributes: [
      { display_type: null, trait_type: "Type", value: "War Banner" }, 
    ]
  }

  console.log("0.1 =====================");
  console.log(JSON.stringify(returnSeedMetaData));

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(returnSeedMetaData),
  };
}

//-------------------------------
module.exports.getBaseChest = async (event) => {

  const uuid = event.pathParameters.id;
  // for debugging locally 
  //const uuid = "3";
  
  let statusCodeVal = 200;
  let bodyVal = { message: "Not found" };


  // The default return response
  const returnSeedMetaData = {
    name: "Base Chest #" + uuid.toString().padStart(4, '0'),
    description: "The limited edition Planet Mojo Base Chest contains a special reward to welcome the Base community to Planet Mojo. Revealing its content unlocks the first ever Planet Mojo NFTs on Base.",
    image: "https://planetmojo-images-prod.s3.amazonaws.com/chests/BaseChest.png",
    animation_url: "https://planetmojo-images-prod.s3.amazonaws.com/chests/BaseChest.mp4",
    attributes: [
      { display_type: null, trait_type: "Type", value: "Base" }, 
    ]
  }

  console.log("0.1 =====================");
  console.log(JSON.stringify(returnSeedMetaData));

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(returnSeedMetaData),
  };
}

