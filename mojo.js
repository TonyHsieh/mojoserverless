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

module.exports.getMojos = async (event) => {

  /*
   * The old way of using a comma separated get...
  // target of the GET
  const uuid = event.pathParameters.id;

  console.log("0 ----------------");
  console.log("id : " + uuid);

  const inputArr = uuid.split(',').map(n => { return Number(n); });
  console.log("number array : " + inputArr);
  */

  // Using the body as part of a POST.
  // This should be giving me a JSON body with an array in it.
  const body = JSON.parse(Buffer.from(event.body, 'base64').toString())
  
  const idArr = body.ids.slice(0,100).map (n => { return Number(n); });
  console.log("Sliced to up to 100 numbers array : " + idArr);

  let statusCodeVal = 200;
  let bodyValArr = [];

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  let scanParams = {
    TableName: process.env.DYNAMODB_MOJO_TABLE,
    Key: {
      uuid: 0,
    },
  };

  let result = 0;

  // Start the loop 
  await idArr.reduce (async (memo, n, index) => {
    await memo;
    console.log("0 - ID " + n + " check ----------------");
    scanParams.Key["uuid"] = n.toString();
    console.log("0 - ID " + n + " -- ScanParams: "+ JSON.stringify(scanParams) + " ---");

    if (n == "NaN") {
      console.log("ID " + n + " - Not A Number ----------------");
      bodyValArr[index] = { message: "Not a Number" };
    } else { 
      result = await dynamodb.get(scanParams).promise()
        .catch((e) => {console.log("error: " + e)});
      console.log("1 - ID " + n + " check ----------------");
      if (result.Item) {
        const isSprouted = result.Item.isSprouted || false;

        console.log("ID " + n + " found ----------------");
        console.log("isSprouted = " + isSprouted);

        // if sprouted then return 404
        if (isSprouted) {
          // if already sprouted then return 
          console.log("ID " + n + " : ----------------");
          console.log(result.Item);

          bodyValArr[index] = result.Item;
        } else {
          // if not sprouted then return 404
          console.log("ID " + n + " not Sprouted ----------------");
          bodyValArr[index] = { message: "Not Sprouted"} ; 
        }
      } else {
        console.log("ID " + n + " not found ----------------");
        bodyValArr[index] = { message: "Not Found"};
      }
    }

  }, undefined);


  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(bodyValArr),
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
