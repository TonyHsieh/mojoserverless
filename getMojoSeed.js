'use strict'
const AWS = require('aws-sdk')

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
    external_url: "https://api.planetmojo.io/mojo-seed/metadata/" + uuid, 
    image: "https://image.planetmojo.io/Mojo_Seed_NFT.mp4",
    uuid: uuid,
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
