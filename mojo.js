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

module.exports.updateMojo = async (event) => {

  // Update the Mojo with stats.
  // This use uuid to target the specific Mojo.
  // curl -X POST -d '{"id":"1",
  //                   "Level": 0-20,
  //                   "Star Stage": 1-5,
  //                  }' --url   https://api.hsieh.org/mojo/action/update


  console.log("0 ----------------");

  // need to look up the uuid key
  // then get the data from the champion table
  // then update the data based on the data passed in to the function
  // and then check to see if the data passed in is the correct Attributes.

  const input = JSON.parse(event.body);
  console.log("input : " + JSON.stringify(input));
  //const uuid = Number(input.uuid);
  const uuid = input.id;

  let statusCodeVal = 200;

  // for debugging locally
  // const uuid = "3";
  console.log("1 ----------------");
  console.log("uuid : " + uuid);
  console.log("input : " + JSON.stringify(input));

  var bodyVal = { message: "Not found" };

  const dynamodb = new AWS.DynamoDB.DocumentClient();

  console.log("1.2 -----get the mojo values--------");
  if (statusCodeVal == 200) {
    var scanParams = {
      TableName: process.env.DYNAMODB_MOJO_TABLE,
      Key: {
        uuid: uuid,
      },
    };
    let result = await dynamodb.get(scanParams).promise();

    if (result.Item) {
      console.log("1.3 ----mojo get SUCCESS------------");
      console.log("Mojo - item = " + JSON.stringify(result.Item));

      bodyVal = result.Item;
    } else {
      console.log("1.3 ---mojo get FAIL-------------");
      statusCodeVal = 404;
      bodyVal = { message: "Not found" };
      return {
        statusCode: statusCodeVal,
        body: JSON.stringify(bodyVal),
      };
    }
  }

  console.log("2 -----Update the appropriate Attributes-----------");
  if (statusCodeVal == 200) {
    // there needs to be a screening of the trait_type
    // against the accepted trait_types
    //
    const AttributesList = {
      "Level": "display_type~number",
      "Star Stage": "display_type~number",
    }
    console.log("Accepted AttributesList: " + JSON.stringify(AttributesList));

    // loop through the attributes array and find the matching trait_type in the input array
    // if there is a match then run the replaceTraitValue() function to update the value in body
    // if there is no match then do nothing.
    for (const idx in AttributesList) {
      console.log("2.1 -  Attribute: < " + idx + " >");
      console.log("2.1 -  input: < " + JSON.stringify(input) + " >");
      if (idx in input) {
        console.log("2.1 -  Attribute: < " + idx + " > in input parameters: "+ input[idx]);
        replaceOrPushNewTraitsValue(bodyVal.attributes, idx, input[idx], AttributesList[idx]);
      } else {
        // do nothing
        console.log("2.1 -  Attribute: " + idx + " NOT in input parameters.");
        statusCodeVal = 422; // Unprocessable Entity
      }
    }

    console.log("2.5 - updated body: " + JSON.stringify(bodyVal));

  }


  console.log("3 -----Update the ModableMojoData-----------");
  if (statusCodeVal == 200) {
    // Write it into the DynamoDB
    const putParams = {
      TableName: process.env.DYNAMODB_MOJO_TABLE,
      Item: bodyVal,
    }
    await (dynamodb.put(putParams)).promise();
    bodyVal = { message: "Updated" };
  }

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(bodyVal),
  };


  function replaceOrPushNewTraitsValue(list, trait, newValue, newTraitValuesStr) {
    /*
    console.log("  list: " + JSON.stringify(list));
    console.log("  trait: " + trait);
    console.log("  newValue: " + newValue);
    console.log("  newTraitValuesStr: " + newTraitValuesStr);
    */

    var count = 0;
    list.find((o, idx) => {
      if (o["trait_type"] === trait) {
        list[idx]["value"] = newValue;
        count++;
      }
    });
    if (count === 0) {
      let newTraitValues = newTraitValuesStr.split("~");
      //console.log("   == "+ newTraitValues.toString());
      var pushObj = { trait_type: trait, value: newValue };
      for (var i = 0; i < newTraitValues.length; i=i+2)	{
        pushObj[newTraitValues[i]] = newTraitValues[i+1];
        //console.log("   == "+ JSON.stringify(pushObj));
      }
      list.push(pushObj);
    };
  }

}

/*
 * 2024-01-28 - Not using this anymore

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
*/

//--------------------
/*
 * 2024-01-28 - Not using this anymore
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
*/


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
// 2024-09-27 - Checking the rawPath to see if it is calling Mod-able Mojo Base or the original,
//
module.exports.getModableMojo = async (event) => {

  // target of the GET
  const uuid = event.pathParameters.id;
  // for debugging locally
  // const uuid = "3";
  console.log("0 ----------------");
  console.log("id : " + uuid);

  // 2024-09-25 - code to determine if it is calling Mod-able Mojo Base or the original
  const rawPath = event.rawPath;
  const invocationRootPath = rawPath.substring(1, rawPath.indexOf('/', (rawPath.indexOf('/') + 1)));
  const invocationPathTokens = invocationRootPath.split('-');
  const suffixToken = (invocationPathTokens.length > 3) ? invocationPathTokens[3] : "";
  let DYNAMODB_MODABLEMOJO_TABLE = "";
  let DYNAMODB_MODABLEMOJO_NUMBER_TABLE = "";
  if (suffixToken == "base") {
    DYNAMODB_MODABLEMOJO_TABLE = process.env.DYNAMODB_MODABLEMOJO_BASE_TABLE;
    DYNAMODB_MODABLEMOJO_NUMBER_TABLE = process.env.DYNAMODB_MODABLEMOJO_BASE_NUMBER_TABLE;
  } else {
    DYNAMODB_MODABLEMOJO_TABLE = process.env.DYNAMODB_MODABLEMOJO_TABLE;
    DYNAMODB_MODABLEMOJO_NUMBER_TABLE = process.env.DYNAMODB_MODABLEMOJO_NUMBER_TABLE;
  }
  console.log("invocationRootPath : " + invocationRootPath);
  console.log("suffixToken : " + suffixToken);
  // ----------------------

  let statusCodeVal = 200;
  let bodyVal = { message: "Not found" };

  const scanParams = {
    TableName:DYNAMODB_MODABLEMOJO_TABLE,
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

    // if sprouted then return item
    if (isSprouted) {
      // if already sprouted then return 404
      statusCodeVal = 200;
      bodyVal = result.Item;
    } else {
      // 2024-10-21 - Added logic 
      //  if BASE then return the Base Chest metadata   
      //  then return "Not Found" as originally done.
      statusCodeVal = 200;

      if (suffixToken == "base") {
        bodyVal = {
          //name: "Base Chest #" + uuid.toString().padStart(4, '0'),
          name: "Base Chest #" + result.Item.number.toString().padStart(4, '0'),
          description: "The limited edition Planet Mojo Base Chest contains a special reward to welcome the Base community to Planet Mojo. Revealing its content unlocks the first ever Planet Mojo NFTs on Base.",
          image: "https://planetmojo-images-prod.s3.amazonaws.com/chests/BaseChest.png",
          animation_url: "https://planetmojo-images-prod.s3.amazonaws.com/chests/BaseChest.mp4",
          attributes: [
            { display_type: null, trait_type: "Type", value: "Base" }, 
          ]
        }
      }
    }
  }

  // 2024-09-25 - Fast testng feedback.
  //console.log("event : " + JSON.stringify(event));
  //bodyVal = { ...bodyVal, ...event };
  //bodyVal = { ...bodyVal,  invocationRootPath: invocationRootPath, suffixToken: suffixToken };

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(bodyVal),
  };
}

// ---------------------
// 2023-12-02 - this is going to the lookup for the id (hash) using the mojo number
//   this will give you the current id (hash) so you can use it for the metadata/v2/{id} endpoint.
module.exports.getModableMojoHash = async (event) => {

  // target of the GET
  const number = Number(event.pathParameters.number);
  // for debugging locally
  // const number = "3";
  console.log("0 ----------------");
  console.log("number : " + number);

  // 2024-09-25 - code to determine if it is calling Mod-able Mojo Base or the original
  const rawPath = event.rawPath;
  const invocationRootPath = rawPath.substring(1, rawPath.indexOf('/', (rawPath.indexOf('/') + 1)));
  const invocationPathTokens = invocationRootPath.split('-');
  const suffixToken = (invocationPathTokens.length > 3) ? invocationPathTokens[3] : "";
  let DYNAMODB_MODABLEMOJO_TABLE = "";
  let DYNAMODB_MODABLEMOJO_NUMBER_TABLE = "";
  if (suffixToken == "base") {
    DYNAMODB_MODABLEMOJO_TABLE = process.env.DYNAMODB_MODABLEMOJO_BASE_TABLE;
    DYNAMODB_MODABLEMOJO_NUMBER_TABLE = process.env.DYNAMODB_MODABLEMOJO_BASE_NUMBER_TABLE;
  } else {
    DYNAMODB_MODABLEMOJO_TABLE = process.env.DYNAMODB_MODABLEMOJO_TABLE;
    DYNAMODB_MODABLEMOJO_NUMBER_TABLE = process.env.DYNAMODB_MODABLEMOJO_NUMBER_TABLE;
  }
  console.log("invocationRootPath : " + invocationRootPath);
  console.log("suffixToken : " + suffixToken);
  // ----------------------

  let statusCodeVal = 200;
  let bodyVal = { message: "Not found" };

  const scanParams = {
    TableName: DYNAMODB_MODABLEMOJO_NUMBER_TABLE,
    Key: {
      number: number,
    },
  };

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const result = await dynamodb.get(scanParams).promise();

  if (result.Item) {

    console.log("1 ----------------");
    console.log("item = " + JSON.stringify(result.Item));

    // if the number = 0 then return the LastId (the highest number)
    // else return the id (hash) for the given number.
    statusCodeVal = 200;
    bodyVal = result.Item;
  }

  // 2024-09-25 - Fast testng feedback.
  //console.log("event : " + JSON.stringify(event));
  //bodyVal = { ...bodyVal, ...event };
  //bodyVal = { ...bodyVal,  invocationRootPath: invocationRootPath, suffixToken: suffixToken };

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(bodyVal),
  };
}



// ----------
// This is to get multiple mod-able mojo metadata - using an input array of id (hash)
//   Up to 100 ids (hash) at a time.
module.exports.getModableMojos = async (event) => {

  // 2024-09-25 - code to determine if it is calling Mod-able Mojo Base or the original
  const rawPath = event.rawPath;
  const invocationRootPath = rawPath.substring(1, rawPath.indexOf('/', (rawPath.indexOf('/') + 1)));
  const invocationPathTokens = invocationRootPath.split('-');
  const suffixToken = (invocationPathTokens.length > 3) ? invocationPathTokens[3] : "";
  let DYNAMODB_MODABLEMOJO_TABLE = "";
  let DYNAMODB_MODABLEMOJO_NUMBER_TABLE = "";
  if (suffixToken == "base") {
    DYNAMODB_MODABLEMOJO_TABLE = process.env.DYNAMODB_MODABLEMOJO_BASE_TABLE;
    DYNAMODB_MODABLEMOJO_NUMBER_TABLE = process.env.DYNAMODB_MODABLEMOJO_BASE_NUMBER_TABLE;
  } else {
    DYNAMODB_MODABLEMOJO_TABLE = process.env.DYNAMODB_MODABLEMOJO_TABLE;
    DYNAMODB_MODABLEMOJO_NUMBER_TABLE = process.env.DYNAMODB_MODABLEMOJO_NUMBER_TABLE;
  }
  console.log("invocationRootPath : " + invocationRootPath);
  console.log("suffixToken : " + suffixToken);
  // ----------------------

  // Using the body as part of a POST.
  // This should be giving me a JSON body with an array in it.
  //const body = JSON.parse(Buffer.from(event.body, 'base64').toString())
  const body = JSON.parse(event.body);
  console.log("body : " + JSON.stringify(body));

  //const idArr = body.ids.slice(0,100).map (n => { return Number(n); });
  const idArr = body.ids.slice(0,100);
  console.log("Sliced to up to 100 numbers array : " + idArr);

  let statusCodeVal = 200;
  let bodyValArr = [];

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  let scanParams = {
    TableName: DYNAMODB_MODABLEMOJO_TABLE,
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

  // 2024-09-25 - Fast testng feedback.
  //console.log("event : " + JSON.stringify(event));
  //bodyValArr = { ...bodyValArr, ...event };
  //bodyValArr = { ...bodyValArr,  invocationRootPath: invocationRootPath, suffixToken: suffixToken };


  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(bodyValArr),
  };

}

//---------------------
module.exports.mintPrepModableMojo = async (event) => {
  console.log("0 ----------------");

  const ORIGINALSubclassList = {
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
          "value": "",
          "trait_type": "Rarity"
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
          "trait_type": "Face Accessory"
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
          "value": "",
          "trait_type": "Rarity"
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
          "trait_type": "Face Accessory"
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
          "value": "",
          "trait_type": "Rarity"
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
          "trait_type": "Face Accessory"
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
          "value": "",
          "trait_type": "Rarity"
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
          "trait_type": "Face Accessory"
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

  // --------------------------------------------------------------
  // --------------------------------------------------------------
  // --------------------------------------------------------------
  const BASESubclassList = {
    "Flower": {
      //"uuid": "",
      "name": "Mod-able Mojo ",
      //"order": "",
      "number": 0,
      "type": "Flower",
      "isSprouted": "1",
      "external_url": "https://www.planetmojo.io/mod-able-mojo/",
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo-base/",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo-base/",
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
          "value": "Oracle",
          "trait_type": "Generation"
        },
        {
          "value": "",
          "trait_type": "Number"
        },
        {
          "value": "",
          "trait_type": "Rarity"
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
          "trait_type": "Face Accessory"
        },
        {
          "value": "Citrus",
          "trait_type": "Body Color"
        },
        {
          "value": "Base Blue",
          "trait_type": "Background"
        },
        {
          "value": "Snowy Smile",
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
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo-base/",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo-base/",
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
          "value": "Oracle",
          "trait_type": "Generation"
        },
        {
          "value": "",
          "trait_type": "Number"
        },
        {
          "value": "",
          "trait_type": "Rarity"
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
          "value": "Trimmed Leaf",
          "trait_type": "Eyebrows"
        },
        {
          "value": "Flow",
          "trait_type": "Face Marking"
        },
        {
          "value": "None",
          "trait_type": "Face Accessory"
        },
        {
          "value": "Citrus",
          "trait_type": "Body Color"
        },
        {
          "value": "Base Blue",
          "trait_type": "Background"
        },
        {
          "value": "Happy Leap",
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
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo-base/",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo-base/",
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
          "value": "Oracle",
          "trait_type": "Generation"
        },
        {
          "value": "",
          "trait_type": "Number"
        },
        {
          "value": "",
          "trait_type": "Rarity"
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
          "trait_type": "Face Accessory"
        },
        {
          "value": "Spring",
          "trait_type": "Body Color"
        },
        {
          "value": "Base Blue",
          "trait_type": "Background"
        },
        {
          "value": "Very Happy Float",
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
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo-base/",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo-base/",
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
          "value": "Oracle",
          "trait_type": "Generation"
        },
        {
          "value": "",
          "trait_type": "Number"
        },
        {
          "value": "",
          "trait_type": "Rarity"
        },
        {
          "value": "Moss Afro Hair",
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
          "trait_type": "Face Accessory"
        },
        {
          "value": "Summer",
          "trait_type": "Body Color"
        },
        {
          "value": "Base Blue",
          "trait_type": "Background"
        },
        {
          "value": "Kata Crane Idle",
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

  const ClassList = ["Plant"];

  const ORIGINALTypeList = ["Custom", "Samurai Mojo", "Winter Gear - Icy", "Yeti", "Snowman", "Pumpkin Spice", "Fallboy", "Flower", "Leafy",	"Vine",	"Moss",	"Mummy", "Skeleton", "Pirate", "Dinosaur"];
  const ORIGINALSubclassListKeys = Object.keys(ORIGINALSubclassList);
  const ORIGINALGenerationList = ["Genesis"];

  const BASETypeList = ["Custom", "Mummy", "Skeleton", "Flower", "Leafy",	"Vine",	"Moss"];
  const BASESubclassListKeys = Object.keys(BASESubclassList);
  const BAEGenerationList = ["Oracle"];


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
  const FaceAccessoryList = ["Full Beard", "None"];
  const BodyColorList = [ "Autumn Leaves", "Citrus", "Flamingo Pink", "None", "Prehistoric Purple", "Pumpkin", "Spring", "Summer", "Undead" ];
  const BackgroundList = [ "Buccaneer Blue", "Flower Citrus", "Moss Summer", "None", "Pharaoh's Gold", "Raptor Rust", "Spooky Fall", "Twilight Teal", "Vine Citrus", "Vine Spring", "Winter Wonder" ];
  const PoseList = [ "Angry Hands On Hips", "Fighting Stance", "Flare", "Floating", "Happy Hands on Hips", "Happy Idle", "Neutral Floating Idle", "Snowy Smile", "Spooky Fall", "Terrorize", "Very Happy"];
  const AnimationList = [ "Fighting Stance", "Flare", "Floating", "Happy Hands on Hips", "Mischievous", "None", "Snowy Smile", "Terrorize" ];
  const SkinList = ["Boned", "Icicle Blue", "None"];


  // 2024-09-25 - code to determine if it is calling Mod-able Mojo Base or the original
  const rawPath = event.rawPath;
  const invocationRootPath = rawPath.substring(1, rawPath.indexOf('/', (rawPath.indexOf('/') + 1)));
  const invocationPathTokens = invocationRootPath.split('-');
  const suffixToken = (invocationPathTokens.length > 3) ? invocationPathTokens[3] : "";
  let DYNAMODB_MODABLEMOJO_TABLE = "";
  let DYNAMODB_MODABLEMOJO_NUMBER_TABLE = "";
  let SubclassList = []
  let TypeList = [];
  let SubclassListKeys = [];
  let GenerationList = [];
  if (suffixToken == "base") {
    DYNAMODB_MODABLEMOJO_TABLE = process.env.DYNAMODB_MODABLEMOJO_BASE_TABLE;
    DYNAMODB_MODABLEMOJO_NUMBER_TABLE = process.env.DYNAMODB_MODABLEMOJO_BASE_NUMBER_TABLE;

    SubclassList = BASESubclassList;
    TypeList = BASETypeList;
    SubclassListKeys = BASESubclassListKeys;
    GenerationList = BAEGenerationList;

  } else {
    DYNAMODB_MODABLEMOJO_TABLE = process.env.DYNAMODB_MODABLEMOJO_TABLE;
    DYNAMODB_MODABLEMOJO_NUMBER_TABLE = process.env.DYNAMODB_MODABLEMOJO_NUMBER_TABLE;

    SubclassList = ORIGINALSubclassList;
    TypeList = ORIGINALTypeList;
    SubclassListKeys = ORIGINALSubclassListKeys;
    GenerationList = ORIGINALGenerationList;
  }
  console.log("invocationRootPath : " + invocationRootPath);
  console.log("suffixToken : " + suffixToken);
  // ----------------------

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
    "Face Accessory": FaceAccessoryList,
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

      // 2023-12-05 - Kludge! for "Vines" to be "Vine" and for "Leafy" to be "Leaf".
      if ("Vines" === body.Subclass) {
        body.Subclass = "Vine";
      }
      if ("Leaf" === body.Subclass) {
        body.Subclass = "Leafy";
      }
      // ---------

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

    const TypeValueList = Object.keys(TypeValueCheckArray);
    for (const Type of TypeValueList) {
      if (Type in body) {
        if (body[Type] != null) {
          // 2023-12-02 - Commented out - relaxed the check - for the attributes
          //if (TypeValueCheckArray[Type].includes(body[Type])) {
          replaceTraitValue(modableMojoData.attributes, Type, body[Type]);
          console.log("00. OK body ["+ Type + "]: " + body[Type]);
        } else {
          statusCodeVal = 422; // Unprocessable Entity ERROR
          bodyValArr = { message: "01.NOT GOOD DATA- missing ["+ Type + "]: " + body[Type] };
          console.log("01.NOT GOOD DATA- missing ["+ Type + "]: " + body[Type]);
          // 2023-12-02 - Commented out - relaxed the check - for the attributes
          //}
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
        TableName: DYNAMODB_MODABLEMOJO_NUMBER_TABLE,
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
          console.log("0.51 - New mod-able-modjo --> getting LastID from database " + modableMojoData.number);
          isNewModableMojo = true;

          newId = currentId + 1;
          // 2024-10-23 - Kludge! because David Woodruff someone wrote 4149 in the blockchain contract.  Need to skip it.
          //   but only for the base type!
          if ((newId == 4149) && (suffixToken == "base")) {
            newId = 4150;
          } 
          console.log("0.52 - newId: " +newId);

          modableMojoData.number = newId;
          console.log("0.59 - modableMojoData.number: " +modableMojoData.number);

          // 2023-01-05 - randomize the rarity
          const RarityList = ['Common', "Rare", "Legendary", "Mystic"];

          const rarityRandomRoll = Math.random();
          let rarityValue = "nothing"
          if (rarityRandomRoll < 0.9) rarityValue = RarityList[0];
          else if (rarityRandomRoll >= 0.9 && rarityRandomRoll < 0.95) rarityValue = RarityList[1];
          else if (rarityRandomRoll >= 0.95 && rarityRandomRoll < 0.98) rarityValue = RarityList[2];
          else if (rarityRandomRoll >= 0.98 && rarityRandomRoll < 1.0) rarityValue = RarityList[3];
          console.log("0.591 - Show the rarityRandomRoll : " + rarityRandomRoll);
          console.log("0.592 - Show the Rarity : " + rarityValue);

          // set the rarity
          modableMojoData.rarity = rarityValue;
          replaceTraitValue(modableMojoData.attributes, "Rarity", rarityValue);
          console.log("0.593 - modableMojoData.rarity: " +modableMojoData.rarity);
          console.log("0.594 - Show the new modableMojoData with rarity: " + JSON.stringify(modableMojoData));

        } else if (modableMojoData.number > currentId) {
          // simple check if the number is out of range
          statusCodeVal = 422; // Unprocessable Entity ERROR
          bodyValArr = { message: "INVALID NUMBER DATA- modableMojoData.number: "+ modableMojoData.number +" GREATER-THAN currentId: "+ currentId };
          console.log("0.59 - modableMojoData.number: " +modableMojoData.number + " GREATER-THAN currentId: "+ currentId);
        } else {
          // 2023-01-05 - retrieve the current rarity from the modablemojo_Number_Table
          let scanParams = {
            TableName: DYNAMODB_MODABLEMOJO_NUMBER_TABLE,
            Key: {
              number: modableMojoData.number,
            },
            AttributesToGet: ["rarity"],
            ConsistentRead: true,
          };
          console.log("0.52 - scanParams: " + JSON.stringify(scanParams));

          let tableMetaData = await dynamodb.get(scanParams).promise();
          console.log("0.53 - tableMetaData: " + JSON.stringify(tableMetaData));

          // set the current rarity
          modableMojoData.rarity = tableMetaData["Item"]["rarity"];
          replaceTraitValue(modableMojoData.attributes, "Rarity", tableMetaData["Item"]["rarity"]);
          console.log("0.54 - modableMojoData.rarity: " +modableMojoData.rarity);
          console.log("0.55 - Show the existing modableMojoData with rarity: " + JSON.stringify(modableMojoData));
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
      // Uneeded?
      // modableMojoData.isSprouted = "1";

      // if isSprouted is in input body, then set the modableMojoData.isSprouted to false
      if ("isSprouted" in body) {
        console.log("0.91 - Show the isSprouted in body: " + body.isSprouted + " - so setting modableMojoData.isSprouted to false");
        modableMojoData.isSprouted = false;
      }

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

      console.log("2.6 - Show the newly calc metadataHash, mojoIdEncoding, tokenId as uuid changed modableMojoData : " + JSON.stringify(modableMojoData));

      // to depend on the type value being passed in is "Custom" or one of the possible types
      //   if type = "Custom" then set the image and animation_url to uuid.
      if (modableMojoData.type === "Custom") {
        console.log("2.8 - modableMojoData.type is CUSTOM : " + modableMojoData.type);
        modableMojoData.image += modableMojoData.uuid + ".png";
        // 2023-12-13 - Since there is no MP4 for custom, set it to "" (blank)
        modableMojoData.animation_url = "";
      } else {
        console.log("2.8 - modableMojoData.type is TYPE : " + modableMojoData.type);
        modableMojoData.image += modableMojoData.type.replace(/\s/g, "") + ".png";
        if (body.Animation != "None")
          modableMojoData.animation_url += modableMojoData.type.replace(/\s/g, "") + ".mp4";
        else
          modableMojoData.animation_url = "";
      }

      console.log("2.9 - Show modableMojoData with the correct image and animation_url : " + JSON.stringify(modableMojoData));
      console.log("2.91 - Show isNewModableMojo : " + isNewModableMojo);
      console.log("2.92 - Show currentId : " + currentId);



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
                  TableName: DYNAMODB_MODABLEMOJO_NUMBER_TABLE,
                  Item: {
                    number: modableMojoData.number,
                    uuid: modableMojoData.uuid,
                  },
                },
              },
              {
                //   2- Overwrite in the new row with the information needed
                "Put": {
                  TableName: DYNAMODB_MODABLEMOJO_TABLE,
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
      } else { // New mod-able-mojo - Begin the transaction closure
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
                  TableName: DYNAMODB_MODABLEMOJO_TABLE,
                  Item: modableMojoData,
                },
              },
              {
                //   2 - Update the incremented LastID
                Update: {
                  TableName: DYNAMODB_MODABLEMOJO_NUMBER_TABLE,
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
                //        - 2024-01-05 - added rarity field
                "Put": {
                  TableName: DYNAMODB_MODABLEMOJO_NUMBER_TABLE,
                  Item: {
                    number: modableMojoData.number,
                    uuid: modableMojoData.uuid,
                    rarity: modableMojoData.rarity,
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
          // If the transaction fails, then roll back al actions and return a failure service
          //   409 - The request could not be completed due to a conflict with the current state
          //   of the target resource.  This code is used in situations where
          //   the user might be able to resolve the conflict and resumbit the request.
          statusCodeVal = 409;
          bodyValArr = { message : "Create Failed. No changed made. Please attempt again." };
//          bodyValArr = { message : "Create Failed. No changed made. Please attempt again.", 
//            number: modableMojoData.number,
//            uuid: modableMojoData.uuid,
//            rarity: modableMojoData.rarity,
//            ...error
//          };
          console.log("ERROR fail write to db: " + JSON.stringify(error));
        };
      }
    }
  };

  // 2024-09-25 - Fast testng feedback.
  //console.log("event : " + JSON.stringify(event));
  //bodyValArr = { ...bodyValArr, ...event };
  //bodyValArr = { ...bodyValArr,  invocationRootPath: invocationRootPath, suffixToken: suffixToken };

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

//--------------------

module.exports.revealModableMojo = async (event) => {

  // Input from Post
  // uuid, number, wallet, signature, message 

  const ALCHEMY_API_KEY = "C4tFKEm_iQYtmsas8uqsG2tE1NwbruHE"
  
  console.log("0 ----------------");
  const input = JSON.parse(event.body);
  console.log("input : " + JSON.stringify(input));
  const number = Number(input.number);
  const uuid = input.uuid;
  const wallet = input.wallet;
  const signature = input.signature;

  let statusCodeVal = 200;

  // for debugging locally
  // const uuid = "3";
  console.log("1 ----------------");
  console.log("number : " + number);
  console.log("input : " + JSON.stringify(input));

  let bodyVal = { message: "Not found 0 " };
  let imagesURL = "";

  
  console.log("0.1 ----------------");

  // 2024-09-25 - code to determine if it is calling Mod-able Mojo Base or the original 
  const rawPath = event.rawPath;
  const invocationRootPath = rawPath.substring(1, rawPath.indexOf('/', (rawPath.indexOf('/') + 1)));
  const invocationPathTokens = invocationRootPath.split('-'); 
  const suffixToken = (invocationPathTokens.length > 3) ? invocationPathTokens[3] : "";
  let DYNAMODB_MODABLEMOJO_TABLE = "";
  let DYNAMODB_MODABLEMOJO_NUMBER_TABLE = "";
  let MOJO_CONTRACT_ADDRESS = "";
  let ALCHEMY_ENDPOINT_URL = "";
  let bodyImagePath = "";
  if (suffixToken == "base") {
    DYNAMODB_MODABLEMOJO_TABLE = process.env.DYNAMODB_MODABLEMOJO_BASE_TABLE;
    DYNAMODB_MODABLEMOJO_NUMBER_TABLE = process.env.DYNAMODB_MODABLEMOJO_BASE_NUMBER_TABLE;
    bodyImagePath = "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo-base/";

    console.log("process.env.AWS_LAMBDA_FUNCTION_NAME: ", process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (process.env.AWS_LAMBDA_FUNCTION_NAME.indexOf("prod") != -1) {
      console.log("   Choose PROD images!");
      imagesURL = "planetmojo.io"; // PRODUCTION
      MOJO_CONTRACT_ADDRESS = "0xA68da97513f8fFf92924a67Cd7bb5A4E1a95fD18"; // PROD = Base
      ALCHEMY_ENDPOINT_URL = "https://base-mainnet.g.alchemy.com/v2/"; // PROD = Base
    } else {
      console.log("   Choose DEV images!");
      imagesURL = "hsieh.org"; // DEV
      MOJO_CONTRACT_ADDRESS = "0x4643c3D31Db0986234D644199d9CE4A5F461cD5D"; // DEV = Base Sepolia
      ALCHEMY_ENDPOINT_URL = "https://base-sepolia.g.alchemy.com/v2/"; // DEV = Base Sepolia: 
    }

    console.log("0.51 ----- base mojo has contract -----------");
    console.log("imagesURL : " + imagesURL);
    console.log("MOJO_CONTRACT_ADDRESS : " + MOJO_CONTRACT_ADDRESS);
    console.log("ALCHEMY_ENDPOINT_URL : " + ALCHEMY_ENDPOINT_URL);
    //bodyVal += "imagesURL : " + imagesURL + " | MOJO_CONTRACT_ADDRESS : " + MOJO_CONTRACT_ADDRESS + " | ALCHEMY_ENDPOINT_URL : " + ALCHEMY_ENDPOINT_URL;
  
  } else {
    DYNAMODB_MODABLEMOJO_TABLE = process.env.DYNAMODB_MODABLEMOJO_TABLE;
    DYNAMODB_MODABLEMOJO_NUMBER_TABLE = process.env.DYNAMODB_MODABLEMOJO_NUMBER_TABLE;
    bodyImagePath = "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo/";

    // ABORT - there isn't a contract for non Base Mod-Able Mojos.
    console.log("0.52 ----- non base mojo has no contract ABORT -----------");
    statusCodeVal = 404;
    bodyVal = { message: "Not found 1" };

    return {
      statusCode: statusCodeVal,
      body: JSON.stringify(bodyVal),
    };
     
  }
  console.log("invocationRootPath : " + invocationRootPath);  
  console.log("suffixToken : " + suffixToken);  

  //bodyVal += " | DYNAMODB_MODABLEMOJO_TABLE : " + DYNAMODB_MODABLEMOJO_TABLE + " | DYNAMODB_MODABLEMOJO_NUMBER_TABLE : " + DYNAMODB_MODABLEMOJO_NUMBER_TABLE;
  
  // ---------------------- 

  console.log("1.1 -----get the hash--------");
  const dynamodb = new AWS.DynamoDB.DocumentClient();

  console.log("1.2 -----get the modable mojo--------");
  var body = {};
  const scanParams = {
    TableName: DYNAMODB_MODABLEMOJO_TABLE,
    Key: {
      uuid: uuid,
    },
  };

  const result = await dynamodb.get(scanParams).promise();
  if (result != null) {
    if (result.Item) {
      console.log("1.3 ---modableMojoData get SUCCESS-------------");
      console.log("Modable Mojo - item = " + JSON.stringify(result.Item));
      body = result.Item;
      bodyVal = result.Item;

    } else {
      console.log("1.3 ---modableMojoData get FAIL-------------");
      statusCodeVal = 404;
      bodyVal = { message: "Not found 3" };
      return {
        statusCode: statusCodeVal,
        body: JSON.stringify(bodyVal),
      };
    }
  }

  console.log("1.5 -----Check for iSprouted value-----------");

  /* // Testing the signature stuff 
  const message0 = createMessage(uuid, number, wallet);
  bodyVal += " | message0 = " + message0;
  const recoveredAddress = ethers.utils.verifyMessage(message0, signature);
  bodyVal += " | recoveredAddress = " + recoveredAddress;
  const result0 = recoveredAddress.toLowerCase() === wallet.toLowerCase();
  bodyVal += " | result0 = " + result0;
  */ 

  /* // Testing out the ownership crap.
  const provider0 = new ethers.providers.JsonRpcProvider(ALCHEMY_ENDPOINT_URL + ALCHEMY_API_KEY);
  bodyVal += " | provider0 = " + provider0;
  const mojo0 = new ethers.Contract(
    MOJO_CONTRACT_ADDRESS, 
    [ "function ownerOf(uint256 tokenId) external view returns(address)" ], 
    provider0
  );
  bodyVal += " | mojo0 = " + mojo0;
  let owner0 = await mojo0.ownerOf(uuid);
  bodyVal += " | owner0 = " + owner0;
  const result0 = owner0.toLowerCase() === wallet.toLowerCase();
  bodyVal += " | result0 = " + result0;
 */ 


     
  // 2024-10-02 - if the body.isSprouted is false, then we do the validation checks. 
  if (body.isSprouted != true) {
    console.log("1.51 ----- currently not sprouted -----------");
    //bodyVal += " | body.isSprouted = " + body.isSprouted;
     
    if (body.number != number) {
      console.log("1.52 ----- input number "+ number +" doesn't match body.number "+ body.number+"  -----------");
      statusCodeVal = 403; // HTTP error code Forbidden 
      bodyVal = { message: "Invalid number"};
    } else if(!isValidSignature(uuid, number, wallet, signature)) {
      statusCodeVal = 422; // HTTP error code Unprocessable Entity
      bodyVal = { message: "Invalid signature"};
    /*} else if (!await isValidOwner(uuid, wallet)) { 
      statusCodeVal = 401; // HTTP error code Unauthorized
      bodyVal = { message: "You are not the owner of this token"};
    */
    } else {
      // Run the ownership code inline with the code - because calling it didn't seem to work.
      const provider0 = new ethers.providers.JsonRpcProvider(ALCHEMY_ENDPOINT_URL + ALCHEMY_API_KEY);
      const mojo0 = new ethers.Contract(
        MOJO_CONTRACT_ADDRESS, 
        [ "function ownerOf(uint256 tokenId) external view returns(address)" ], 
        provider0
      );
      let owner0 = await mojo0.ownerOf(uuid);
      const result0 = owner0.toLowerCase() === wallet.toLowerCase();
      // -------


      // Check if the result0 owner is the same as the wallet.
      if (!result0) {
        statusCodeVal = 401; // HTTP error code Unauthorized
        bodyVal = { message: "You are not the owner of this token"};
      } else {
        console.log("1.53 ----- valid signature, owner of this token, and input number "+ number + " matches body.number "+ body.number +" -----------");
        body.isSprouted = true; // REVEAL

        // update the database.
        console.log("2.5 - updated body: " + JSON.stringify(body));
        //bodyVal += " | 2.5 - Updated Sprouted body = " + JSON.stringify(body);


        console.log("3 -----Update the ModableMojoData-----------");

        // Write it into the DynamoDB
        const putParams = {
          TableName: DYNAMODB_MODABLEMOJO_TABLE,
          Item: body,
        }
        await (dynamodb.put(putParams)).promise();
        bodyVal = body;
      }
    }
  }
  

  // 2024-09-25 - Fast testng feedback.
  //console.log("event : " + JSON.stringify(event));
  //bodyVal = { ...bodyVal, ...event }; 
  //bodyVal = { ...bodyVal,  invocationRootPath: invocationRootPath, suffixToken: suffixToken };
  //bodyVal += " | 3 - Updated Sprouted body in DB = " + body;

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(bodyVal),
  };


  // - internal functions --

  function isValidSignature(tokenId, tokenNumber, walletAddress, signature) {
    const message = createMessage(tokenId, tokenNumber, walletAddress);

    try {
      const recoveredAddress = ethers.utils.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
    } catch {
      return false;
    }
  }
 
  /* Some reason it is not working -- 
  async function isValidOwner(walletAddress, tokenId) {
    const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_ENDPOINT_URL + ALCHEMY_API_KEY);

    const mojo = new ethers.Contract(
      MOJO_CONTRACT_ADDRESS, 
      [ "function ownerOf(uint256 tokenId) external view returns(address)" ], 
      provider
    );

    //try {
      let owner = await mojo.ownerOf(tokenId)
      return owner.toLowerCase() === walletAddress.toLowerCase();
    /*}
    catch {
      return false;
    }
  }
  */


  // Got this function from Hrvoje
  function createMessage(tokenId, tokenNumber, walletAddress) {
    return "Welcome to Planet Mojo! Click to sign to reveal your Base Chest " + tokenNumber + " contents. This request will not trigger a blockchain transaction or cost any gas fees. Wallet address: " + walletAddress + " Token ID: " + tokenId; 
  }

}



//--------------------

module.exports.updateModableMojo = async (event) => {

  // Update the Modable Mojo.
  // This is going to use the Mojo Number instead of using the Mojo id..
  // curl -X POST -d '{"number":1,
  //                   "isSprouted": "true", // 2024-10-02 - this would be new!
  //                   "Head": "something",
  //                   "Eyewear": "something",
  //                   "Upper Body": "something",
  //                   "Lower Body": "something",
  //                   "Hands": "something",
  //                   "Feet": "something",
  //                   "Costume": "something",
  //                   "Eye Color": "something",
  //                   "Eyebrows": "something",
  //                   "Face Marking": "something",
  //                   "Face Accessory": "something",
  //                   "Body Color": "something",
  //                   "Background": "something",
  //                   "Pose": "something",
  //                   "Animation": "something",
  //                   "Skin": "something",
  //                   "Level": 0-20,
  //                   "Star Stage": 1-5,
  //                  }' --url   https://api.hsieh.org/mojo/action/update

  console.log("0 ----------------");

  // 2024-09-25 - code to determine if it is calling Mod-able Mojo Base or the original 
  const rawPath = event.rawPath;
  const invocationRootPath = rawPath.substring(1, rawPath.indexOf('/', (rawPath.indexOf('/') + 1)));
  const invocationPathTokens = invocationRootPath.split('-'); 
  const suffixToken = (invocationPathTokens.length > 3) ? invocationPathTokens[3] : "";
  let DYNAMODB_MODABLEMOJO_TABLE = "";
  let DYNAMODB_MODABLEMOJO_NUMBER_TABLE = "";
  let bodyImagePath = "";
  if (suffixToken == "base") {
    DYNAMODB_MODABLEMOJO_TABLE = process.env.DYNAMODB_MODABLEMOJO_BASE_TABLE;
    DYNAMODB_MODABLEMOJO_NUMBER_TABLE = process.env.DYNAMODB_MODABLEMOJO_BASE_NUMBER_TABLE;
    bodyImagePath = "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo-base/";
  } else {
    DYNAMODB_MODABLEMOJO_TABLE = process.env.DYNAMODB_MODABLEMOJO_TABLE;
    DYNAMODB_MODABLEMOJO_NUMBER_TABLE = process.env.DYNAMODB_MODABLEMOJO_NUMBER_TABLE;
    bodyImagePath = "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo/";
  }
  console.log("invocationRootPath : " + invocationRootPath);  
  console.log("suffixToken : " + suffixToken);  
  // ---------------------- 


  // need to look up the hash key from the number
  // then get the data from the modable mojo table
  // then update the data based on the data passed in to the function
  // and then check to see if the data passed in is the correct Attributes.

  const input = JSON.parse(event.body);
  console.log("input : " + JSON.stringify(input));
  const number = Number(input.number);

  let statusCodeVal = 200;
  let bodyValArr = [];

  // for debugging locally
  // const uuid = "3";
  console.log("1 ----------------");
  console.log("number : " + number);
  console.log("input : " + JSON.stringify(input));

  let bodyVal = { message: "Not found" };

  console.log("1.1 -----get the hash--------");
  const dynamodb = new AWS.DynamoDB.DocumentClient();

  var scanParams = {
    TableName: DYNAMODB_MODABLEMOJO_NUMBER_TABLE,
    Key: {
      number: number,
    },
  };
  let result = await dynamodb.get(scanParams).promise();
  let uuid = "";

  if (result.Item) {
    console.log("1.2 ----hash get SUCCESS------------");
    console.log("Mojo Lookup - item = " + JSON.stringify(result.Item));

    // if the number = 0 then return the LastId (the highest number)
    // else return the id (hash) for the given number.
    uuid = result.Item.uuid;
  } else {
    console.log("1.2 ----hash get FAIL------------");
    statusCodeVal = 404;
    bodyVal = { message: "Not found" };
    return {
      statusCode: statusCodeVal,
      body: JSON.stringify(bodyVal),
    };
  }

  console.log("1.2 -----get the modable mojo--------");
  var body = {};
  scanParams = {
    TableName: DYNAMODB_MODABLEMOJO_TABLE,
    Key: {
      uuid: uuid,
    },
  };

  result = await dynamodb.get(scanParams).promise();
  if (result.Item) {
    console.log("1.3 ---modableMojoData get SUCCESS-------------");
    console.log("Modable Mojo - item = " + JSON.stringify(result.Item));

    body = result.Item;
  } else {
    console.log("1.3 ---modableMojoData get FAIL-------------");
    statusCodeVal = 404;
    bodyVal = { message: "Not found" };
    return {
      statusCode: statusCodeVal,
      body: JSON.stringify(bodyVal),
    };
  }

  console.log("1.5 -----Check for iSprouted value-----------");
  // 2024-10-02 - if the isSprouted exists in the input body then set the value to true
  if ("isSprouted" in input) {
    body.isSprouted = true;
  }

  console.log("2 -----Update the appropriate Attributes-----------");
  // there needs to be a screening of the trait_type
  // against the accepted trait_types
  //
  const AttributesList = [
    "Head",
    "Eyewear",
    "Upper Body",
    "Lower Body",
    "Hands",
    "Feet",
    "Costume",
    "Eye Color",
    "Eyebrows",
    "Face Marking",
    "Face Accessory",
    "Body Color",
    "Background",
    "Pose",
    "Animation",
    "Skin",
    "Level",
    "Star Stage",
  ];
  console.log("Accepted AttributesList: " + JSON.stringify(AttributesList));



  // loop through the attributes array and find the matching trait_type in the input array
  // if there is a match then run the replaceTraitValue() function to update the value in body
  // if there is no match then do nothing.
  for (const idx in AttributesList) {
    const attribute = AttributesList[idx];
    if (attribute in input) {
      console.log("2.1 -  Attribute: " + attribute + " in input parameters: "+ input[attribute]);
      replaceOrPushTraitValue(body.attributes, attribute, input[attribute]);
    } else {
      // do nothing
      console.log("2.1 -  Attribute: " + attribute + " NOT in input parameters.");
    }
  }

  // check for the "ImageAnimName" in the input array
  // 2023-12-13 - The Update doesn't provide an MP4 - we need to set it to blank.
  if ("ImageAnimName" in input) {
    //
    // TODO - NEED TO SET A STRING FOR THIS mod-able-mojo versus mod-able-mojo-base
    //
    body.image = bodyImagePath + input.ImageAnimName + ".png";
    //body.animation_url = "https://planetmojo-images-prod.s3.amazonaws.com/mod-able-mojo/" + input.ImageAnimName + ".mp4";
    body.animation_url = "";
  }

  console.log("2.5 - updated body: " + JSON.stringify(body));

  console.log("3 -----Update the ModableMojoData-----------");

  // Write it into the DynamoDB
  const putParams = {
    TableName: DYNAMODB_MODABLEMOJO_TABLE,
    Item: body,
  }
  await (dynamodb.put(putParams)).promise();
  bodyVal = { message: "Updated" };

  // 2024-09-25 - Fast testng feedback.
  //console.log("event : " + JSON.stringify(event));
  //bodyVal = { ...bodyVal, ...event }; 
  //bodyVal = { ...bodyVal,  invocationRootPath: invocationRootPath, suffixToken: suffixToken };
  
  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(bodyVal),
  };


  //-------
  // NOTE: this is slightly dirty hack and this only works with the NUMBER type for Level and Star Stage..
  function replaceOrPushTraitValue(list, trait, newValue) {
    var count = 0;
    list.find((o, idx) => {
      if (o["trait_type"] === trait) {
        //list[idx] = { trait_type:list[idx].trait_type, value: newValue }
        list[idx]["value"] = newValue;
        count++;
      }
    });
    if (count === 0) {
      // this should only push these particular traits
      if ((trait === "Level") || (trait === "Star Stage")) {
        list.push({ trait_type: trait, value: newValue, display_type: "number" });
      }
    };
  }
}
