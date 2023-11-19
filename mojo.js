'use strict'
const AWS = require('aws-sdk')
//const Web3 = require('web3')
//const OpenSeaSDK = require('opensea-js')
const ethers = require('ethers')

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

// ---------------------
// 2023-11-15 this is for the old Pumpkin Spice and Fallboy mod-able Mojos.  
//   Delete this and the related table when they switch over to them.
module.exports.getModableMojoOld = async (event) => {

  // target of the GET
  const uuid = event.pathParameters.id;
  // for debugging locally
  // const uuid = "3";
  console.log("0 ----------------");
  console.log("id : " + uuid);

  let statusCodeVal = 200;
  let bodyVal = { message: "Not found" };

  const scanParams = {
    TableName: process.env.DYNAMODB_MODABLEMOJO_OLD_TABLE,
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

// ---------------------
// 2023-11-15 - this is going to the the metadata/v2/{id} endpoint.
//   Stuck with the v2 endpoint forever.
module.exports.getModableMojo = async (event) => {

  // target of the GET
  const uuid = event.pathParameters.id;
  // for debugging locally
  // const uuid = "3";
  console.log("0 ----------------");
  console.log("id : " + uuid);

  let statusCodeVal = 200;
  let bodyVal = { message: "Not found" };

  const scanParams = {
    TableName: process.env.DYNAMODB_MODABLEMOJO_TABLE,
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

//---------------------
module.exports.mintPrepModableMojo = async (event) => {
  console.log("0 ----------------"); 

  const SubclassList = {
    "Flower": {
      //"uuid": "",
      "name": "Mod-able Mojo ",
      //"order": "",
      "number": 0,
      "type": "Flower",
      "isSprouted": "1",
      "external_url": "https://www.planetmojo.io/mod-able-mojo/",
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo/",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo/",
      "description": "Mod-able Mojos are a new collection from Planet Mojo where users will be able to swap parts and customize the look of their Mojos both in-game, and on-chain. Mojos are powerful plant heroes brought forth by the planet to battle the deadly threat known as the Scourge. They are 3D playable game characters in Mojo Melee and future games and experiences set inside the Planet Mojo Universe.",
      "attributes": [
        {
          "value": "Plant",
          "trait_type": "Class"
        },
        {
          "value": "Flower",
          "trait_type": "Subclass"
        },
        {
          "value": "Genesis",
          "trait_type": "Generation"
        },
        {
          "value": "",
          "trait_type": "Number"
        },
        {
          "value": "Blooming Iris Hair",
          "trait_type": "Head"
        },
        {
          "value": "None",
          "trait_type": "Eyewear"
        },
        {
          "value": "Flower Base",
          "trait_type": "Upper Body"
        },
        {
          "value": "None",
          "trait_type": "Lower Body"
        },
        {
          "value": "None",
          "trait_type": "Hands"
        },
        {
          "value": "None",
          "trait_type": "Feet"
        },
        {
          "value": "Flower Base",
          "trait_type": "Costume"
        },
        {
          "value": "Pink Eyes",
          "trait_type": "Eye Color"
        },
        {
          "value": "Busy Succulent",
          "trait_type": "Eyebrows"
        },
        {
          "value": "Neutral",
          "trait_type": "Face Marking"
        },
        {
          "value": "None",
          "trait_type": "Facial Hair"
        },
        {
          "value": "Citrus",
          "trait_type": "Body Color"
        },
        {
          "value": "Flower Citrus",
          "trait_type": "Background"
        },
        {
          "value": "Happy Idle",
          "trait_type": "Pose"
        },
        {
          "value": "None",
          "trait_type": "Animation"
        },
        {
          "value": "None",
          "trait_type": "Skin"
        }
      ],
    },
    "Leafy": {
      //"uuid": "",
      "name": "Mod-able Mojo ",
      //"order": "",
      "number": 0,
      "type": "Leafy",
      "isSprouted": "1",
      "external_url": "https://www.planetmojo.io/mod-able-mojo/",
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo/",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo/",
      "description": "Mod-able Mojos are a new collection from Planet Mojo where users will be able to swap parts and customize the look of their Mojos both in-game, and on-chain. Mojos are powerful plant heroes brought forth by the planet to battle the deadly threat known as the Scourge. They are 3D playable game characters in Mojo Melee and future games and experiences set inside the Planet Mojo Universe.",
      "attributes": [
        {
          "value": "Plant",
          "trait_type": "Class"
        },
        {
          "value": "Leafy",
          "trait_type": "Subclass"
        },
        {
          "value": "Genesis",
          "trait_type": "Generation"
        },
        {
          "value": "",
          "trait_type": "Number"
        },
        {
          "value": "Leafy Full Hair",
          "trait_type": "Head"
        },
        {
          "value": "None",
          "trait_type": "Eyewear"
        },
        {
          "value": "Leafy Base",
          "trait_type": "Upper Body"
        },
        {
          "value": "None",
          "trait_type": "Lower Body"
        },
        {
          "value": "None",
          "trait_type": "Hands"
        },
        {
          "value": "None",
          "trait_type": "Feet"
        },
        {
          "value": "Leafy Base",
          "trait_type": "Costume"
        },
        {
          "value": "Lemonata Eyes",
          "trait_type": "Eye Color"
        },
        {
          "value": "Succulent",
          "trait_type": "Eyebrows"
        },
        {
          "value": "Neutral",
          "trait_type": "Face Marking"
        },
        {
          "value": "None",
          "trait_type": "Facial Hair"
        },
        {
          "value": "Citrus",
          "trait_type": "Body Color"
        },
        {
          "value": "Vine Citrus",
          "trait_type": "Background"
        },
        {
          "value": "Very Happy",
          "trait_type": "Pose"
        },
        {
          "value": "None",
          "trait_type": "Animation"
        },
        {
          "value": "None",
          "trait_type": "Skin"
        }
      ],
    },
    "Vine": {
      //"uuid": "",
      "name": "Mod-able Mojo ",
      //"order": "",
      "number": 0,
      "type": "Vine",
      "isSprouted": "1",
      "external_url": "https://www.planetmojo.io/mod-able-mojo/",
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo/",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo/",
      "description": "Mod-able Mojos are a new collection from Planet Mojo where users will be able to swap parts and customize the look of their Mojos both in-game, and on-chain. Mojos are powerful plant heroes brought forth by the planet to battle the deadly threat known as the Scourge. They are 3D playable game characters in Mojo Melee and future games and experiences set inside the Planet Mojo Universe.",
      "attributes": [
        {
          "value": "Plant",
          "trait_type": "Class"
        },
        {
          "value": "Vine",
          "trait_type": "Subclass"
        },
        {
          "value": "Genesis",
          "trait_type": "Generation"
        },
        {
          "value": "",
          "trait_type": "Number"
        },
        {
          "value": "Bok Choy Hair",
          "trait_type": "Head"
        },
        {
          "value": "None",
          "trait_type": "Eyewear"
        },
        {
          "value": "Vine Base",
          "trait_type": "Upper Body"
        },
        {
          "value": "None",
          "trait_type": "Lower Body"
        },
        {
          "value": "None",
          "trait_type": "Hands"
        },
        {
          "value": "None",
          "trait_type": "Feet"
        },
        {
          "value": "Vine Base",
          "trait_type": "Costume"
        },
        {
          "value": "Blue Grey Eyes",
          "trait_type": "Eye Color"
        },
        {
          "value": "Full Moss",
          "trait_type": "Eyebrows"
        },
        {
          "value": "Neutral",
          "trait_type": "Face Marking"
        },
        {
          "value": "None",
          "trait_type": "Facial Hair"
        },
        {
          "value": "Spring",
          "trait_type": "Body Color"
        },
        {
          "value": "Vine Spring",
          "trait_type": "Background"
        },
        {
          "value": "Angry Hands On Hips",
          "trait_type": "Pose"
        },
        {
          "value": "None",
          "trait_type": "Animation"
        },
        {
          "value": "None",
          "trait_type": "Skin"
        }
      ],
    },
    "Moss": {
      //"uuid": "",
      "name": "Mod-able Mojo ",
      //"order": "",
      "number": 0,
      "type": "Moss",
      "isSprouted": "1",
      "external_url": "https://www.planetmojo.io/mod-able-mojo/",
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo/",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo/",
      "description": "Mod-able Mojos are a new collection from Planet Mojo where users will be able to swap parts and customize the look of their Mojos both in-game, and on-chain. Mojos are powerful plant heroes brought forth by the planet to battle the deadly threat known as the Scourge. They are 3D playable game characters in Mojo Melee and future games and experiences set inside the Planet Mojo Universe.",
      "attributes": [
        {
          "value": "Plant",
          "trait_type": "Class"
        },
        {
          "value": "Moss",
          "trait_type": "Subclass"
        },
        {
          "value": "Genesis",
          "trait_type": "Generation"
        },
        {
          "value": "",
          "trait_type": "Number"
        },
        {
          "value": "Afro Large Hair",
          "trait_type": "Head"
        },
        {
          "value": "None",
          "trait_type": "Eyewear"
        },
        {
          "value": "Moss Base",
          "trait_type": "Upper Body"
        },
        {
          "value": "None",
          "trait_type": "Lower Body"
        },
        {
          "value": "None",
          "trait_type": "Hands"
        },
        {
          "value": "None",
          "trait_type": "Feet"
        },
        {
          "value": "Moss Base",
          "trait_type": "Costume"
        },
        {
          "value": "Green Eyes",
          "trait_type": "Eye Color"
        },
        {
          "value": "Busy Succulent",
          "trait_type": "Eyebrows"
        },
        {
          "value": "Swirl Left eye",
          "trait_type": "Face Marking"
        },
        {
          "value": "None",
          "trait_type": "Facial Hair"
        },
        {
          "value": "Summer",
          "trait_type": "Body Color"
        },
        {
          "value": "Moss Summer",
          "trait_type": "Background"
        },
        {
          "value": "Neutral Floating Idle",
          "trait_type": "Pose"
        },
        {
          "value": "None",
          "trait_type": "Animation"
        },
        {
          "value": "None",
          "trait_type": "Skin"
        }
      ],
    }
  }; 
  
  //-----
//  const CHUNK_LENGTH = 8 + 2;
//  const uid = () =>
//    String(
//      Math.random().toString(10).padEnd(CHUNK_LENGTH,"0").substring(0, CHUNK_LENGTH) + 
//      Date.now().toString(10) +
//      Math.random().toString(10).padEnd(CHUNK_LENGTH,"0").substring(0, CHUNK_LENGTH)
//    ).replace(/0\./g, '')
  //-----

  const TypeList = ["Snowman", "Pumpkin Spice", "Fallboy", "Flower", "Leafy",	"Vine",	"Moss",	"Mummy", "Skeleton", "Pirate", "Dinosaur"];
  const ClassList = ["Plant"];
  const SubclassListKeys = Object.keys(SubclassList);
  const GenerationList = ["Genesis"];

  const HeadList = ["None", "Snowman Head",	"Fall Beanie","Blooming Iris Hair", "Leafy Full Hair", "Bok Choy Hair", "Afro Large Hair", "Mummy Mask", "Pirate Tricorn Hat with eyepatch", "Dino Head"];
  const EyewearList = ["None"];
  const UpperBodyList = [ "Dino T-Shirt", "Fallboy T-Shirt", "Flower Base", "Leafy Base", "Moss Base", "None", "Skeleton T-Shirt", "Snowman Body", "Vine Base", "Wrap Star T-Shirt" ];
  const LowerBodyList = ["None"];
  const HandsList = ["None", "Snowman Mittens"];
  const FeetList = ["Mojo Kicks - Argh!", "Mojo Kicks - Mummy", "Mojo Kicks - Scales", "None" ];

  const CostumeList = ["Dinosaur", "Fallboy", "Flower Base", "Leafy Base", "Moss Base", "Mummy", "Pirate", "Pumpkin Spice", "Skeleton", "Snowman", "Vine Base" ];
  const EyeColorList = ["Blue Grey Eyes", "Candy Cornea", "Caribbean Blue", "Green Eyes", "Green Glow", "Grim Pink", "Jurassic Yellow", "Lemonata Eyes", "Pink Eyes", "Slime Yellow", "Winter" ];
  const EyebrowsList = [ "Busy Succulent", "Full Moss", "None", "Succulent" ];
  const FaceMarkingList = [ "Flow", "Neutral", "None", "Striped", "Swirl Left eye", "Winter"];
  const FacialHairList = ["Full Beard", "None"];
  const BodyColorList = [ "Autumn Leaves", "Citrus", "Flamingo Pink", "None", "Prehistoric Purple", "Pumpkin", "Spring", "Summer", "Undead" ];
  const BackgroundList = [ "Buccaneer Blue", "Flower Citrus", "Moss Summer", "None", "Pharaoh's Gold", "Raptor Rust", "Spooky Fall", "Twilight Teal", "Vine Citrus", "Vine Spring", "Winter Wonder" ];
  const PoseList = [ "Angry Hands On Hips", "Fighting Stance", "Flare", "Floating", "Happy Hands on Hips", "Happy Idle", "Neutral Floating Idle", "Snowy Smile", "Spooky Fall", "Terrorize", "Very Happy"]; 
  const AnimationList = [ "Fighting Stance", "Flare", "Floating", "Happy Hands on Hips", "Mischievous", "None", "Snowy Smile", "Terrorize" ];
  const SkinList = ["Boned", "Icicle Blue", "None"];

  const TypeValueCheckArray = {
    "Type": TypeList,
    "Class": ClassList,
    "Subclass": SubclassListKeys,
    "Generation": GenerationList,
    "Head": HeadList,
    "Eyewear": EyewearList,
    "Upper Body": UpperBodyList,
    "Lower Body": LowerBodyList,
    "Hands": HandsList,
    "Feet": FeetList,
    "Costume": CostumeList,
    "Eye Color": EyeColorList,
    "Eyebrows": EyebrowsList,
    "Face Marking": FaceMarkingList,
    "Facial Hair": FacialHairList,
    "Body Color": BodyColorList,
    "Background": BackgroundList,
    "Pose": PoseList,
    "Animation": AnimationList,
    "Skin": SkinList
  }

  const dynamodb = new AWS.DynamoDB.DocumentClient();

  const body = JSON.parse(event.body);
  console.log("00 - Show the input body: " + JSON.stringify(body));

  var statusCodeVal = 200;
  var bodyValArr = [];

  var mojoSubclass = "";
  var modableMojoData = []; 
  if ("Subclass" in body) {
    if  (body.Subclass != null) {
      if (SubclassListKeys.includes(body.Subclass)) {
        mojoSubclass = body.Subclass;
        console.log("00.PASSED_IN - mojoSubclass: " + mojoSubclass);
      } else {
        statusCodeVal = 422; // Unprocessable Entity ERROR
        bodyValArr = { message: "00.NOT GOOD DATA- body.Subclass: < "+ body.Subclass +" > -- mojoSubclass: <" + mojoSubclass + ">"}; 
        console.log("00.NOT GOOD DATA- body.Subclass: < "+ body.Subclass +" > -- mojoSubclass: <" + mojoSubclass + ">");
      }
    }
  }

  if (statusCodeVal == 200) {
    // Init the modableMojoData 
    modableMojoData = JSON.parse(JSON.stringify(SubclassList[mojoSubclass]));
    console.log("0 - Show the modableMojoData : " + JSON.stringify(modableMojoData)); 

    const TypeList = Object.keys(TypeValueCheckArray);
    for (const Type of TypeList) {
      if (Type in body) {
        if (body[Type] != null) {
          if (TypeValueCheckArray[Type].includes(body[Type])) {
            replaceTraitValue(modableMojoData.attributes, Type, body[Type]); 
            console.log("00. OK body ["+ Type + "]: " + body[Type]);
          } else {
            statusCodeVal = 422; // Unprocessable Entity ERROR
            bodyValArr = { message: "01.NOT GOOD DATA- missing ["+ Type + "]: " + body[Type] }; 
            console.log("01.NOT GOOD DATA- missing ["+ Type + "]: " + body[Type]);
          }
        }
      }
    }

    // ------------
    // Set the modableMojoData.number - from the modableMojoNumberTable
    var currentId = 0;
    var newId = 0;

    if (statusCodeVal == 200) {
      // get the current MAX index from the dynamooDB 
      let scanParams = {
        TableName: process.env.DYNAMODB_MODABLEMOJO_NUMBER_TABLE,
        Key: {
          number: 0,
        }, 
        AttributesToGet: ["LastID"],
        ConsistentRead: true,
      };
      console.log("0.32 - scanParams: " + JSON.stringify(scanParams));

      let tableMetaData = await dynamodb.get(scanParams).promise();
      console.log("0.33 - tableMetaData: " + JSON.stringify(tableMetaData));

      // set the currentId
      currentId = Number(tableMetaData["Item"]["LastID"]);
      console.log("0.34 - currentId: " + currentId);
    }


    // Check if there is request for a new modableMojo
    var isNewModableMojo = false;
    if (statusCodeVal == 200) { 
      modableMojoData.type = body.Type;
      if ("Number" in body) {
        modableMojoData.number = Number(body.Number);
        console.log("0.50 - modableMojoData.number: " +modableMojoData.number);

        if (modableMojoData.number == -1) {
          console.log("0.51 - New mod-able-modjo --> getting LastID from database " +modableMojoData.number);
          isNewModableMojo = true;

          // set the modableMojoData.number = currentId + 1
//          let scanParams = {
//            TableName: process.env.DYNAMODB_MODABLEMOJO_NUMBER_TABLE,
//            Key: {
//              number: 0,
//            }, 
//            AttributesToGet: ["LastID"],
//            ConsistentRead: true,
//          };
//          console.log("0.52 - scanParams: " + JSON.stringify(scanParams));
//
//          let tableMetaData = await dynamodb.get(scanParams).promise();
//          console.log("0.53 - tableMetaData: " + JSON.stringify(tableMetaData));
//
//          // Increment lastID by one
//          currentId = Number(tableMetaData["Item"]["LastID"]);
          newId = currentId + 1;
          modableMojoData.number = newId;
          console.log("0.59 - modableMojoData.number: " +modableMojoData.number);

        } else if (modableMojoData.number > currentId) {
          statusCodeVal = 422; // Unprocessable Entity ERROR
          bodyValArr = { message: "INVALID NUMBER DATA- modableMojoData.number: "+ modableMojoData.number +" GREATER-THAN currentId: "+ currentId };
          console.log("0.59 - modableMojoData.number: " +modableMojoData.number + " GREATER-THAN currentId: "+ currentId);
        }
      }
    }

    if (statusCodeVal == 200) {
      
      console.log("0.9 - Show the changed modableMojoData : " + JSON.stringify(modableMojoData)); 

      // ----------
      // start filling in the mod-able Mojo body
      replaceTraitValue(modableMojoData.attributes, "Number", modableMojoData.number); 
      modableMojoData.name = "Mod-able Mojo " + modableMojoData.number;
      modableMojoData.order = modableMojoData.number.toString().padStart(6, '0');
      // eventually this needs to depend on the type value being passed in or not... 
      //   if not passed in, then this needs to be the number (mojoNumber)
      modableMojoData.image += modableMojoData.type.replace(/\s/g, "") + ".png"; 
      modableMojoData.animation_url += modableMojoData.type.replace(/\s/g, "") + ".mp4"; 
      modableMojoData.isSprouted = "1";

      console.log("1.9 - Show the changed modableMojoData before hashing values: " + JSON.stringify(modableMojoData)); 

      // ----------
      // NFT calc code from Jure 
      console.log("2.0 - Entering hashing code"); 
      const rawMojoIdEncodingVersion = 0;
      const rawMojoNumber = modableMojoData.number;
      const rawMetadata = JSON.stringify(modableMojoData); // this shoud be the JSON of the metadata
      console.log("2.1 - Show the rawMojoIdEncodingVersion: " + rawMojoIdEncodingVersion + "\n rawMojoNumber: "+ rawMojoNumber + "\n rawMetadata: " + rawMetadata); 

      const mojoIdEncodingVersion = ethers.BigNumber.from(rawMojoIdEncodingVersion);
      const mojoNumber = ethers.BigNumber.from(rawMojoNumber);
      const metadataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(rawMetadata));
      console.log("2.1 - Show the  metadataHash: " + metadataHash); 

      const tokenId = ethers.utils.keccak256(ethers.utils.solidityPack(
        [
          "uint8", 
          //"uint64",
          "bytes32"
        ], 
        [
          mojoIdEncodingVersion,
          //mojoNumber,
          metadataHash
        ]
      ));

      console.log("2.3 - Show tokenId (hex): " + tokenId); // To get the hex representation

      modableMojoData.uuid = ethers.BigNumber.from(tokenId).toString();
      console.log("2.4 - Show tokenId (dec): " + modableMojoData.uuid);// To get the decimal representation

      modableMojoData.external_url += modableMojoData.uuid;
      modableMojoData.metadataHash = metadataHash;
      modableMojoData.mojoIdEncodingVersion = mojoIdEncodingVersion;
      
      console.log("2.9 - Show the newly calc metadataHash, mojoIdEncoding, tokenId as uuid changed modableMojoData : " + JSON.stringify(modableMojoData)); 

      // ----------
      // Write it into the DynamoDB
      //   -- this will need to be a transaction to write both to tables
      //   the DYNAMODB_MODABLEMOJO_NUMBER_TABLE - index on MojoNumber and write the uuid, and encoding version
      //   the DYNAMODB_MODABLEMOJO_TABLE - write the modableMojoData
      if (!isNewModableMojo) {
        try {
          const response = await dynamodb.transactWrite({
            TransactItems: [
              {
                //   1- Use the number as index and overwrite the uuid in DynamoDB_MODABLEMOJO_NUMBER_TABLE   
                "Put": {
                  TableName: process.env.DYNAMODB_MODABLEMOJO_NUMBER_TABLE, 
                  Item: {
                    number: modableMojoData.number,
                    uuid: modableMojoData.uuid,
                  }, 
                },
              },
              {
                //   2- Overwrite in the new row with the information needed
                "Put": {
                  TableName: process.env.DYNAMODB_MODABLEMOJO_TABLE, 
                  Item: modableMojoData, 
                },
              },
            ],
          }).promise();

          // ----------
          // Success exiting
          bodyValArr = modableMojoData; 
          console.log("3.0 - SUCCESS existing mod-able-mojo write to both db: " + JSON.stringify(response));

        } catch (error) { 
          // If the transaction fails, then roll back both actions and return a failure service 
          //   409 - The request could not be completed due to a conflict with the current state
          //   of the target resource.  This code is used in sutiaotns where 
          //   the user might be able to resolve the conflict and resumbit the request.
          //statusCodeVal = 409;
          statusCodeVal = 500; 
          bodyValArr = { message : "Transaction Update failed. No changed made. Please attempt again." }; 
          console.log("3.0 - ERROR fail write to db: " + JSON.stringify(error));
        };

        // ----------
        // Success exiting
        bodyValArr = modableMojoData; 
        console.log("SUCCESS - existing mod-able-mojo write to db: ");

      } else {
        // New mod-able-mojo - Begin the transaction closure
        // -- this will need to be a transaction to write both to tables
        // the DYNAMODB_MODABLEMOJO_TABLE - write the modableMojoData
        // the DYNAMODB_MODABLEMOJO_NUMBER_TABLE - increment the LastID 
        // the DYNAMODB_MODABLEMOJO_NUMBER_TABLE - index on MojoNumber and write the uuid, and encoding version
        //   There will be a conditional expression on the DYNAMODB_MODABLEMOJO_NUMBER_TABLE index on MojoNumber to see no duplicates.
        try {
          const response = await dynamodb.transactWrite({
            TransactItems: [
              {
                //   1 - Put in the new row with the information needed
                "Put": {
                  TableName: process.env.DYNAMODB_MODABLEMOJO_TABLE, 
                  Item: modableMojoData, 
                },
              },
              {
                //   2 - Update the incremented LastID 
                Update: {
                  TableName: process.env.DYNAMODB_MODABLEMOJO_NUMBER_TABLE,
                  Key: { number: 0 },
                  "ConditionExpression": "LastID = :currentId",
                  "UpdateExpression": "SET LastID = LastID + :incr",
                  "ExpressionAttributeValues": {
                    ":incr": 1,
                    ":currentId": currentId,
                  }, 
                },
              },
              {
                //   3 - Put in the new row with the information needed
                "Put": {
                  TableName: process.env.DYNAMODB_MODABLEMOJO_NUMBER_TABLE, 
                  Item: {
                    number: modableMojoData.number,
                    uuid: modableMojoData.uuid,
                  }, 
                },
                "ConditionalExpression": "attribute_not_exists(number)",
              },
            ],
          }).promise();

          // ----------
          // Success exiting
          bodyValArr = modableMojoData; 
          console.log("SUCCESS new mod-able-mojo write to db: " + JSON.stringify(response));


        } catch (error) { 
          // If the transaction fails, then roll back both actions and return a failure service 
          //   409 - The request could not be completed due to a conflict with the current state
          //   of the target resource.  This code is used in sutiaotns where 
          //   the user might be able to resolve the conflict and resumbit the request.
          statusCodeVal = 409;
          bodyValArr = { message : "Create Failed. No changed made. Please attempt again." }; 
          console.log("ERROR fail write to db: " + JSON.stringify(error));
        };
      }
    }
  };

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(bodyValArr),
  };


//-------
  function replaceTraitValue (inputList, trait, newValue) {
    inputList.find((o, idx) => {
      if (o["trait_type"] == trait) {
        inputList[idx]["value"] = newValue;
      };
    });
  }

}
