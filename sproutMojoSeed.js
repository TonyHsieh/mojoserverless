'use strict'
const AWS = require('aws-sdk')
const ethers = require('ethers')

module.exports.sproutMojoSeed = async (event) => {

  const apiKey = process.env.API_KEY;

  // The default return response
  const returnSeedMetaData = {
    external_url: "https://api.planetmojo.io/mojo-seed/metadata/" + uuid, 
    image: "https://image.planetmojo.io/Mojo_Seed_NFT.mp4"
  }

  // ------------ 
  // target of the UPDATE (put)
  const uuid = event.pathParameters.id;
  // getting < something > from the input body. 
  const body = JSON.parse(Buffer.from(event.body, 'base64').toString())
  
  const dynamodb = new AWS.DynamoDB.DocumentClient();

  let statusCodeVal = 200;
  let bodyVal = "";

  //const result = await dynamodb.get(scanParams).promise();
  const result = retrieveFromDynamoDB(dynamodb, uuid);

 
  console.log("1 =====================");
  console.log(JSON.stringify(body));
  console.log("2 =====================");
  console.log(JSON.stringify(result.Item.isSprouted));
  console.log(JSON.stringify(result.Item.nextCheckTime));
  console.log("3 =====================");
  console.log("4 =====================");


  // ------------ 
  // if isSprouted then do nothing and return a 404 
  // if NOT isSprouted and currentTime < nextCheckTime then do nothing and return (unrevealed) Seed Movie
  // if NOT isSprouted and currentTime > nextCheckTime then
  //          update the nextCheckTime to Date.now() plus 15 seconds (so you can't overcheck the contract)
  //          do a check (which costs money) for the SeedPlanted Contract 
  //          if isPlanted then update NFT to be isSprouted = Date.now()
  //          write out the value back to DynamoDB
  //
  if (result.Item.isSprouted) {
    // if sprouted then return 404
    statusCodeVal = 404;
    bodyVal = "{ }";
  } else if (Date.now() > result.Item.nextCheckTime) {
    // return the cached results
    statusCodeVal = 200;
    bodyVal = returnSeedMetaData; 
  } else {
    // if not sprouted and enough time has elapse then check the sprouterContract. 
    //const isPlanted = await sprouterContract.isSeedPlanted(seedId);
    //isPlanted = callContractIsSeedPlanted(id) 
    
    // TEST - TEMPORARY CODE!
    const seedId = 3;
    const isPlanted = callContractIsSeedPlanted(seedId) 

    // update nextCheckTime to Date.now() + (15 second * 1000 ms)
    result.Item.nextCheckTime = Date.now() + (15 * 1000);

    // ifPlanted but not Sprouted then write new isSprouted to be true.
    if (isPlanted && !result.Item.isSprouted) {
      //Add the information here.
      result.Item.isSprouted = Date.now();
    }
  
    putIntoDynamoDB(dynamodb, result.Item); 

    statusCodeVal = 200;
    bodyVal = returnSeedMetaData; 
  } 

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(bodyVal),
  };



  function retrieveFromDynamoDB(_dynamodb, _uuid) {
    console.log("Entering retrieveFromDynamoDB");

    // Look up the target Mojo  
    const scanParams = {
      TableName: process.env.DYNAMODB_MOJO_TABLE,
      Key: {
        uuid: _uuid,
      },
    };


    const _result = await _dynamodb.get(scanParams).promise();
    
    return _result; 
  }

  function putIntoDynamoDB(_dynamodb, _body) {
    console.log("Entering putIntoDynamoDB");

    const putParams = {
      TableName: process.env.DYNAMODB_MOJO_TABLE, 
      Item: JSON.stringify(_body) 
      }
    return await _dynamodb.put(putParams).promise();
  }

  function callContractIsSeedPlanted(_id) {

    console.log("Entering callContractIsSeedPlanted");

    // Prepare for callins the Contract's isSeedPlanted
    const provider = new ethers.providers.JsonRpcProvider('https://polygon-mainnet.g.alchemy.com/v2/'+ apiKey);
    const sprouterContractAddress = "0x34bff0c8eC197D72c4cb95Ee5a8Be9644FED5022";
    const sprouterContract = new Contract(
      sprouterContractAddress, 
      [ "function isSeedPlanted(uint256) external view returns(bool)" ], 
      provider
    );

    // if not sprouted and enough time has elapse then check the sprouterContract. 
    const isPlanted = await sprouterContract.isSeedPlanted(_id);
    
    console.log("5 =====================");
    console.log("isPlanted = " + isPlanted);
    console.log("6 =====================");

    return isPlanted;
  } 
}
