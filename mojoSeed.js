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
    const provider = new ethers.providers.JsonRpcProvider('https://polygon-mainnet.g.alchemy.com/v2/'+ apiKey);
    let mojoContractAddress = ""; 
    
    console.log("process.env.AWS_LAMBDA_FUNCTION_NAME: ", process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (process.env.AWS_LAMBDA_FUNCTION_NAME.indexOf("prod") != -1) {
      console.log("   Choose PROD mojo contract!");
      mojoContractAddress = "0x43f2932341c1F619648c7A077b49393Ca882b4d1"; // PRODUCTION
    } else {
      console.log("   Choose DEV mojo contract!");
      mojoContractAddress = "0x5BFA11B93a86816CAD05Ef3683aAda0cECA61f9A"; // DEV
    }
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
module.exports.getMoviePoster = async (event) => {

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

  let mojoURL = "";
  console.log("process.env.AWS_LAMBDA_FUNCTION_NAME: ", process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (process.env.AWS_LAMBDA_FUNCTION_NAME.indexOf("prod") != -1) {
    console.log("   Choose PROD mojo URL!");
    mojoURL = "https://www.planetmojo.io"; // PRODUCTION
  } else {
    console.log("   Choose DEV mojo URL!");
    mojoURL = "https://develop.d4ptv3m4dtbv3.amplifyapp.com"; // DEV
  }
  console.log("Mojo URL: ", mojoURL);


  // The default return response
  const returnSeedMetaData = {
    uuid: uuid,
    image: "https://images.planetmojo.io/MojoTrailerPoster.png",
    name: "Planet Mojo Cinematic Collector's Pass",
    external_url: mojoURL + "/collectibles/" + uuid, 
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
