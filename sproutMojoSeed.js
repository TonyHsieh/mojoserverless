'use strict'
const AWS = require('aws-sdk')
const ethers = require('ethers')

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

  //const result = await dynamodb.get(scanParams).promise();
  const result = await retrieveFromDynamoDB(dynamodb, uuid);

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
