'use strict'
const AWS = require('aws-sdk')
//const Web3 = require('web3')
//const OpenSeaSDK = require('opensea-js')

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


//--------------------

module.exports.getMojoOpensea = async (event) => {

  // target of the GET 
  const uuid = event.pathParameters.id;
  // for debugging locally 
  // const uuid = "3";
  
  console.log("0 ----------------");
  console.log("id : " + uuid); 

  let statusCodeVal = 200;
  let bodyVal = { message: "Not found" };

  /* 
  const Network = OpenSeaSDK.Network;
  const provider = new Web3.providers.HttpProvider('https://mainnet.infura.io');

  const openseaSDK = new OpenSeaSDK(provider, {
    networkName: Network.Main,
    apiKey: YOUR_OPENSEA_API_KEY
  })

  const asset: OpenSeaAsset = await openseaSDK.api.getAsset ({ 
    tokenAddress, // string 
    tokenId, // string | number | null 
  });

  if (asset != null) {
    bodyVal = asset;
  }
  */

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(bodyVal),
  };
}



//--------------------

module.exports.getMojoPfp = async (event) => {

  // target of the GET 
  const uuid = event.pathParameters.id;
  // for debugging locally 
  // const uuid = "3";
  
  console.log("0 ----------------");
  console.log("id : " + uuid); 

  let statusCodeVal = 200;
  let bodyVal = { message: "Not found" };

  // Check if the mojo id isSprouted
  const scanParams = {
    TableName: process.env.DYNAMODB_MOJO_TABLE,
    Key: {
      uuid: uuid,
    },
  };

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const result = await dynamodb.get(scanParams).promise();

  let responsePNG = "";

  if (result.Item) {
    const isSprouted = result.Item.isSprouted || false;

    console.log("1 ----------------");
    console.log("isSprouted = " + isSprouted);

    // if sprouted then return no body 
    if (isSprouted) {
      // if already sprouted then return png! 
      console.log("2 ----------------");
      console.log("Starting the reading of file");
      
      // Get the image file from DIR_KEY
      const DIR_PFP_KEY = process.env.DIR_PFP_KEY;
      /*
      let imagesURL = "xx";
      console.log("process.env.AWS_LAMBDA_FUNCTION_NAME: ", process.env.AWS_LAMBDA_FUNCTION_NAME);
      if (process.env.AWS_LAMBDA_FUNCTION_NAME.indexOf("prod") != -1) {
        console.log("   Choose PROD images!");
        imagesURL = "planetmojo.io"; // PRODUCTION
      } else {
        console.log("   Choose DEV images!");
        imagesURL = "hsieh.org"; // DEV
      }
      */

      const s3 = new AWS.S3();
      const bucket = process.env.S3_PLANETMOJO_IMAGES;

      const imagePNGfilename = "mojo_"+ uuid.toString().padStart(6,'0') + ".png";

      const paramsPNG = {
        Bucket: bucket, 
        Key: DIR_PFP_KEY + "/" + imagePNGfilename
      };
      try {
        console.log("=== PNG read ===");
        console.log("PNG read: params:: "  + JSON.stringify(paramsPNG));
        responsePNG = await s3.getObject(paramsPNG).promise();
      } catch (err) {
        // Log the fact that the file was (probably) not found
        console.log("suppress: " + err);
        // AND return with NOT FOUND message
        return {
          statusCode: statusCodeVal,
          body: JSON.stringify(bodyVal),
        }
      }
      console.log("PNG read: " + responsePNG);
      //console.log("PNG read - base64: " + responsePNG['Body'].toString('base64'));

    } else {
      // if not sprouted then return not found in body 
      return {
        statusCode: statusCodeVal,
        body: JSON.stringify(bodyVal),
      }
    }
  } else {
    return {
      statusCode: statusCodeVal,
      body: JSON.stringify(bodyVal),
    }
  }



  return {
    statusCode: statusCodeVal,
    headers: {"Content-Type": "image/png"},
    isBase64Encoded: true,
    body: responsePNG['Body'].toString('base64')
  };
}
