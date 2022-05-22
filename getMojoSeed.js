'use strict'
const AWS = require('aws-sdk')
//const ethers = require('ethers')

module.exports.getMojoSeed = async (event) => {

  // target of the UPDATE (put)
  const uuid = event.pathParameters.id;

  let statusCodeVal = 200;
  let bodyVal = "";

  // Look up the target Mojo  
  const scanParams = {
    TableName: process.env.DYNAMODB_MOJO_TABLE,
    Key: {
      uuid: uuid,
    },
  };

  // The default return response
  const returnSeedMetaData = {
    external_url: "https://api.planetmojo.io/mojo-seed/metadata/" + uuid, 
    image: "https://image.planetmojo.io/Mojo_Seed_NFT.mp4",
    uuid: uuid,
  }

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const result = await dynamodb.get(scanParams).promise();

  const body = JSON.parse(Buffer.from(event.body, 'base64').toString())

  console.log("1 =====================");
  console.log(JSON.stringify(body));
  console.log("2 =====================");
  console.log(JSON.stringify(result.Item.isSprouted));
  console.log("3 =====================");

  // if sprouted then return 404
  if (result.Item.isSprouted) {
    // if already sprouted then return 404
    statusCodeVal = 404;
    bodyVal = "{ }";
  } else {
  // if not sprouted then return the seed video 
    statusCodeVal = 200;
    bodyVal = returnSeedMetaData; 
  }

  
  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(bodyVal),
  };
}
