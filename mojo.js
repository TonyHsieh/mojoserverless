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

//--------------------

module.exports.updateMojoGameStats = async (event) => {


  // Using the body as part of a POST.
  // This should be giving me a JSON body with id + values to update in it.
  // curl -X POST -d '{"id":"1", 
  //                   "attributes": [
  //                       {"trait_type":"Aqua Power", "value": 30, "display_type": "boost_number"}, 
  //                       {"trait_type":"Stamina Increase", "value": 60, "display_type": "boost_percentage"}, 
  //                       {"trait_type":"Wisdom", "value": 18, "display_type": "number"}, 
  //                       {"trait_type":"Class", "value": "Borat"} // NOTE this will not work as this is a protected Trait
  //                    ] 
  //                  }' --url   https://api.hsieh.org/mojo/action/update

  console.log("0 ----------------");
  
  // Removed this and made this simpler -- only a simple JSON.parse(event.body)
  //   This was needed so I could post this via Postman with the IAM authorization working.
  //   So the POST body needs to be raw data and "Content-Type: application/json"
  //
  //  OVERLY COMPLEX? -- const input = JSON.parse(Buffer.from(event.body, 'base64').toString().trim());
  //
  //
   
  const input = JSON.parse(event.body);
  console.log("input : " + JSON.stringify(input));
  const uuid = input.id; 
  
  let statusCodeVal = 200;
  let bodyValArr = [];

  // for debugging locally
  // const uuid = "3";
  console.log("1 ----------------");
  console.log("uuid : " + uuid);
  console.log("input.attributes : " + JSON.stringify(input.attributes));

  let bodyVal = { message: "Not found" };

  console.log("2 ----------------");
  // there needs to be a screening of the trait_type
  // against the existing and PERMANENT trait_types
  //
  const protectedTraits = [ 
    "Class",
    "Subclass",
    "Rarity",
    "Headpiece",
    "Eyebrows",
    "Color Palette",
    "Eye Color",
    "Pose",
    "Face",
    "Face Accessory",
    "Generation",
    "Animation",
    "Background",
  ];
  const filteredAttributes = filterOutAttributes (input.attributes, protectedTraits);
  console.log("filteredAttributes: " + JSON.stringify(filteredAttributes));
  const filteredTraits = Object.keys(filteredAttributes);
  console.log("filteredTraits: " + JSON.stringify(filteredTraits));

  console.log("3 ----------------");
  const scanParams = {
    TableName: process.env.DYNAMODB_MOJO_TABLE,
    Key: {
      uuid: uuid,
    },
  };

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  console.log("3.5 ----------------");

  const result = await dynamodb.get(scanParams).promise();

  console.log("4 ----------------");
  if (result.Item) {

    console.log("4.1 ----------------");

    let matchedTraitType = "";
    let itemAttributes = result.Item.attributes;

    // First, clear out any matching updates 
    for (let traitUpdate in filteredAttributes) {

      // delete any duplicate attributes.
      // but start from highest index to lowest..
      for (let innerIndex = itemAttributes.length - 1; innerIndex >= 0; innerIndex--) {
        matchedTraitType = itemAttributes[innerIndex].trait_type;

        console.log("4.2 - traitUpdate: " + traitUpdate + " -- matchedTraitType: " + matchedTraitType);
        if (protectedTraits.includes(matchedTraitType)) {
          console.log("4.2 - PROTECTED: " + matchedTraitType);
        } else {
          if (filteredTraits.includes(matchedTraitType)) {
            // splice it out 
            console.log("4.2 - MATCHED!!!  matchedTraitType: " + matchedTraitType);
            itemAttributes.splice(innerIndex, 1);
          }
        }
      }
    }
    
    // THEN, insert all of updated attributes 
    for (let traitUpdate in filteredAttributes) {
      //and push in new 
      itemAttributes.push(filteredAttributes[traitUpdate]);
      console.log("4.2 - PUSHING!!! matchedTraitType: " + traitUpdate + " - filteredAttributes: " + JSON.stringify(filteredAttributes[traitUpdate])
                      + "output-Attributes: " + JSON.stringify(itemAttributes));
    } 


    console.log("4.3 -----------------");
    console.log("output-Attributes: "+ JSON.stringify(itemAttributes));
    // Write it into the DynamoDB
    const putParams = {
      TableName: process.env.DYNAMODB_MOJO_TABLE, 
      Item: result.Item, 
    }
    await (dynamodb.put(putParams)).promise();
    bodyVal = { message: "Updated" };
    

  }

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(bodyVal),
  };

  //-----
  function filterOutAttributes (attributes, filterList) {
    console.log("=== filterOutAttributes - ENTER");
    console.log("attributes: " + JSON.stringify(attributes));
    console.log("filterList: " + JSON.stringify(filterList));
    let attributesOutput = {};

    // loop through the attribute array
    for (let attribute in attributes) {
      // and look for the trait_type in the attributes array
      console.log("attribute #" + JSON.stringify(attribute) + ": " + JSON.stringify(attributes[attribute]));
      
      // and if it matches any item in the filterList, 
      //   const fruits = ["Banana", "Orange", "Apple", "Mango"];
      //   fruits.includes("Mango");
      //       then  add to attributesOutput array
      let test_trait_type = attributes[attribute].trait_type;
      if (!filterList.includes(test_trait_type)) {
        attributesOutput[test_trait_type] = attributes[attribute];
      }
    } 

    console.log("attributesOutput: " + JSON.stringify(attributesOutput));
    console.log("=== filterOutAttributes - EXIT");
    return attributesOutput;
  }
    
}

//--------------------

module.exports.clearMojoGameStats = async (event) => {

  // this will only clear out unprotectedTraits

  console.log("0 ----------------");

  // target of the GET
  const uuid = event.pathParameters.id;

  let statusCodeVal = 200;
  let bodyValArr = [];

  // for debugging locally
  // const uuid = "3";
  console.log("1 ----------------");
  console.log("uuid : " + uuid);

  let bodyVal = { message: "Not found" };

  console.log("2 ----------------");
  // there needs to be a screening of the trait_type
  // against the existing and PERMANENT trait_types
  //
  const protectedTraits = [ 
    "Class",
    "Subclass",
    "Rarity",
    "Headpiece",
    "Eyebrows",
    "Color Palette",
    "Eye Color",
    "Pose",
    "Face",
    "Face Accessory",
    "Generation",
    "Animation",
    "Background",
  ];

  console.log("3 ----------------");
  const scanParams = {
    TableName: process.env.DYNAMODB_MOJO_TABLE,
    Key: {
      uuid: uuid,
    },
  };

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  console.log("3.5 ----------------");

  const result = await dynamodb.get(scanParams).promise();

  console.log("4 ----------------");
  let itemAttributes = [];
  
  if (result.Item) {

    console.log("4.1 ----------------");

    let matchedTraitType = "";
    itemAttributes = result.Item.attributes;

    // delete any duplicate attributes.
    // but start from highest index to lowest..
    for (let innerIndex = itemAttributes.length - 1; innerIndex >= 0; innerIndex--) {
      matchedTraitType = itemAttributes[innerIndex].trait_type;

      console.log("4.2 - #"+innerIndex+ " - matchedTraitType: " + matchedTraitType);
      if (protectedTraits.includes(matchedTraitType)) {
        // Do Nothing!  Leave in place!
        console.log("4.2 - PROTECTED: " + matchedTraitType);
      } else {
        // Remove unprotected Trait
        // splice it out 
        console.log("4.2 - REMOVED!!!  matchedTraitType: " + matchedTraitType);
        itemAttributes.splice(innerIndex, 1);
      }
    }
  }

  console.log("4.3 -----------------");
  console.log("output-Attributes: "+ JSON.stringify(itemAttributes));
  // Write it into the DynamoDB
  const putParams = {
    TableName: process.env.DYNAMODB_MOJO_TABLE, 
    Item: result.Item, 
  }
  await (dynamodb.put(putParams)).promise();
  bodyVal = { message: "Updated" };


  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(bodyVal),
  };

}
