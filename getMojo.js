'use strict'
const AWS = require('aws-sdk')

module.exports.getMojo = async (event) => {

  // target of the GET 
  const uuid = event.pathParameters.id;
  // for debugging locally 
  // const uuid = "3";
  console.log("0 ----------------");
  console.log("id : " + uuid); 

  let statusCodeVal = 200;
  let bodyVal = { message: "Not found" };
  
  const scanParams = {
    TableName: process.env.DYNAMODB_MOJO_TABLE,
    Key: {
      uuid: uuid,
    },
  };

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const result = await dynamodb.get(scanParams).promise();

  if (result.Item) {
    const isSprouted = result.Item.isSprouted || false;

    console.log("1 ----------------");
    console.log("isSprouted = " + isSprouted);

    // if sprouted then return 404
    if (isSprouted) {
      // if already sprouted then return 404
      statusCodeVal = 200;
      bodyVal = result.Item;
    } else {
      // if not sprouted then return 404 
      statusCodeVal = 200;
    }
  }

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(bodyVal),
  };
}
