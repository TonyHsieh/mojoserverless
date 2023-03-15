'use strict'
const AWS = require('aws-sdk')
//const Web3 = require('web3')
//const OpenSeaSDK = require('opensea-js')
const ethers = require('ethers')

//--------------------

module.exports.getChampion = async (event) => {

  // target of the GET
  const uuid = event.pathParameters.id;
  // for debugging locally
  // const uuid = "3";
  console.log("0 ----------------");
  console.log("id : " + uuid);

  let statusCodeVal = 200;
  let bodyVal = { message: "Not found" };

  const scanParams = {
    TableName: process.env.DYNAMODB_CHAMPION_TABLE,
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

module.exports.getChampions = async (event) => {

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
    TableName: process.env.DYNAMODB_CHAMPION_TABLE,
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
          //bodyValArr[index] = { message: "Not Sprouted"} ; 
          bodyValArr[index] = { message: "Not Found"} ; 
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

module.exports.unboxChampion = async (event) => {

  const apiKey = process.env.API_KEY;

  // ------------
  // This is the additional offset
  let idOffset = 0; 
  console.log("process.env.AWS_LAMBDA_FUNCTION_NAME: ", process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (process.env.AWS_LAMBDA_FUNCTION_NAME.indexOf("prod") != -1) {
    console.log("   Choose PROD offset!");
    idOffset = 5000; // this is the offset value for PROD
  } else {
    console.log("   Choose DEV offset!");
    idOffset = 100; // this is the offset value for DEV
  }
  console.log("idOffset = " + idOffset);

  let temp_uuid = parseInt(event.pathParameters.id, 10) + idOffset;
  
  // ------------ 
  // target of the UPDATE (put)
  const search_uuid = event.pathParameters.id;
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
  console.log("search_uuid: " + JSON.stringify(search_uuid));
  console.log("uuid: " + uuid);
  
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
      //TEMP WORKAROUND
      //const canUnbox = true; 
      const canUnbox = await callContractCanUnbox(search_uuid); 
      console.log("canUnbox = " + canUnbox);

      //TEMP WORKAROUND
      //const isChampionExists = false;
      const isChampionExists = await callChampionContract(uuid);
      console.log("isChampionExists = " + isChampionExists);

      // update nextCheckTime to Date.now() + (15 second * 1000 ms)
      result.Item.nextCheckTime = Date.now() + (15 * 1000);

      statusCodeVal = 200;

      // ifPlanted but not Sprouted then write new isSprouted to be true.
      if ((canUnbox || isChampionExists) && !result.Item.isSprouted) {
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

    // Look up the target Champion  
    const scanParams = {
      TableName: process.env.DYNAMODB_CHAMPION_TABLE,
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
      TableName: process.env.DYNAMODB_CHAMPION_TABLE, 
      Item: _body, 
    }
    return await (_dynamodb.put(putParams)).promise();
  }


  // --------
  async function callContractCanUnbox(_id) {

    console.log("**** Entering callContractCanUnbox");

    // Prepare for callins the Contract's canUnbox() 
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
      sprouterContractAddress = "0x05c7b8b09D139D808607257d1CaA3A58D2B243C1"; // DEV
    }
    
    const provider = new ethers.providers.JsonRpcProvider(providerURL + apiKey);
    console.log("Provider: ", providerURL);
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

    // Prepare for callins the Contract's canUnbox() 
    //const provider = new ethers.providers.JsonRpcProvider('https://polygon-mainnet.g.alchemy.com/v2/'+ apiKey);
    console.log("_id = " + _id);
    let providerURL = "xx"; 
    let championContractAddress = ""; 

    console.log("process.env.AWS_LAMBDA_FUNCTION_NAME: ", process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (process.env.AWS_LAMBDA_FUNCTION_NAME.indexOf("prod") != -1) {
      console.log("   Choose PROD champion contract!");
      providerURL = "https://polygon-mainnet.g.alchemy.com/v2/"; // PRODUCTION
      championContractAddress = "0x43f2932341c1F619648c7A077b49393Ca882b4d1"; // PRODUCTION
    } else {
      console.log("   Choose DEV champion contract!");
      providerURL = "https://polygon-mumbai.g.alchemy.com/v2/"; // DEV 
      championContractAddress = "0x64Ba948Cb6C05429cCa8cdE7f8A75dd3F0700cbc"; // DEV
    }
    
    const provider = new ethers.providers.JsonRpcProvider(providerURL + apiKey);
    console.log("Provider: ", providerURL);
    console.log("Champion contract: ", championContractAddress);

    const championContract = new ethers.Contract(
      championContractAddress,
      [ "function exists(uint256 tokenId) external view returns (bool)"],
      provider
    );
    console.log("Champion contract innards: ", championContract);

    // if not sprouted and enough time has elapse then check the Champion Contract. 
    return (championContract.exists(_id));
    
  } 
}

