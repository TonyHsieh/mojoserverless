'use strict'
const AWS = require('aws-sdk')
const ethers = require('ethers')

module.exports.getMojo = async (event) => {

  // target of the UPDATE (put)
  const uuid = event.pathParameters.id;

  let statusCodeVal = 200;
  let bodyVal = "";

  // Look up the target Mojo  
  const scanParams = {
    TableName: process.env.DYNAMODB_MOJO_TABLE,
    Key: {
      uuid: event.pathParameters.id,
    },
  };

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const result = await dynamodb.get(scanParams).promise();

  const body = JSON.parse(Buffer.from(event.body, 'base64').toString())

  console.log("1 =====================");
  console.log(JSON.stringify(body));
  console.log("2 =====================");
  console.log(JSON.stringify(result.Item.isSprouted));
  console.log("3 =====================");
  // check if isSprouted already true or non-zero ( timestamp )
  if ("isSprouted" in result.Item) {
    // if true - then response is 200 OK. 
    statusCodeVal = 200;
    bodyVal = "Already Sprouted"
  } else {
    //if false - then 
   
    // do the signature check logic
    const recoveredAddr = ethers.utils.verifyTypedData(domain, types, value, event.pathParameters.signedMessage)
    const isSignerMatching = !!(recoveredAddr === body.signerAddr)

    console.log ("recoveredAddr = " + recoveredAddr);
    console.log ("signerAddr = " + body.signerAddr);

    if (!isSignerMatching) {

      //if it not verified then response is 400 Bad Request with 
      // signature check failed message.  
      statusCodeVal = 400;
      bodyVal = {
        type: "/errors/signature-verification-fail",
        title: "Signature verification fail.",
        status: 400,
        detail: "Authentication failed due to signature verification fail.",
        instance: "/sproutMojo/"+ uuid,
      }    
    } else {
      //if verified then 
    
      //add isSprouted with timeStamp (Date.now())
      result.Item.isSprouted = Date.now();
    
    //update the result-body to DynamoDB
      const putParams = {
        TableName: process.env.DYNAMODB_MOJO_TABLE,
        Item: JSON.stringify(result.Item), 
      }

      await dynamoDb.put(putParams).promise();

      //response is 200 OK
      statusCodeVal = 200;
    } 


    console.log(JSON.stringify(result.Item));

    return {
      statusCode: statusCodeVal,
      body: JSON.stringify(bodyVal),
    };
  }
}
