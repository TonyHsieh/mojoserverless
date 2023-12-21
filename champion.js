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
    idOffset = 6746; // this is the offset value for PROD
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
    image: "https://planetmojo-images-prod.s3.amazonaws.com/ChampionChest.mp4"
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
      sprouterContractAddress = "0x05Dd6aCF8E6956417d98aF10743AC97206d630a2"; // PRODUCTION
    } else {
      console.log("   Choose DEV sprouter contract!");
      providerURL = "https://polygon-mumbai.g.alchemy.com/v2/"; // DEV 
      sprouterContractAddress = "0xFb36b258e250516Ef047f806cd6440bd2C14E91e"; // DEV
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
      championContractAddress = "0x90C45Bb702384812825dA4971054fdb6836582a0"; // PRODUCTION
    } else {
      console.log("   Choose DEV champion contract!");
      providerURL = "https://polygon-mumbai.g.alchemy.com/v2/"; // DEV 
      championContractAddress = "0xC8F8299f19d11106bEE8fBdC34f64e8fA9EC0Bf9"; // DEV
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

//--------------------

module.exports.createChampion = async (event, context) => {

  console.log("000 - enter createChampion ");
  const TypeDataList = {
    "badger": {
      "uuid": "",
      "name": "Krumble Gravelstache #",
      "external_url": "https://www.planetmojo.io/champion/",
      "order": 0,
      "type": "Badger",
      "rarity": "Miner",
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/champions/BadgerKrumble_Base_",
      "isSprouted": "1",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/champions/BadgerKrumble_Base.glb",
      "description": "Krumble has led Clan Mustel for as long as anyone can remember.  A superb fighter when challenged, he is wise enough to gather power from the wealth underground hoarding magic extracted from buried crystals and the roots of enchanted trees. Krumble would prefer to trade and negotiate with the other clans, but he has kept his clan safe with his well-earned reputation for merciless counter-attack, when bargaining fails.",
      "attributes": [
        {
          "trait_type": "Clan",
          "value": "Clan Mustel"
        },
        {
          "trait_type": "Class",
          "value": "Miner"
        },
        {
          "trait_type": "Name",
          "value": "Krumble Gravelstache"
        },
        //          {
        //            "trait_type": "Rarity",
        //            "value": "Mystic"
        //          },
        {
          "trait_type": "Gender",
          "value": "Male"
        },
        {
          "trait_type": "Biome",
          "value": "Underground"
        },
        {
          "trait_type": "Generation",
          "value": "Foundation"
        },
        {
          "trait_type": "Background",
          "value": "Underground Orange"
        },
        {
          "trait_type": "Skin",
          "value": "Light Armor"
        },
        {
          "trait_type": "Pose",
          "value": "Pick & Pop"
        },
        {
          "trait_type": "Media Type",
          "value": "3D"
        }
      ]
    },
    "bear": {
      "uuid": "",
      "name": "Brooka Clawhaven #",
      "external_url": "https://www.planetmojo.io/champion/",
      "order": 1,
      "type": "Bear",
      "rarity": "Mystic",
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/champions/BearBrooka_Base_",
      "isSprouted": "1",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/champions/BearBrooka_Base_",
      "description": "Born to be a fighter, raised to be a leader, he will stop at nothing to defend his caves and his people. He is strapping, courageous, a warrior among warriors. He is Brooka Clawhaven, High Chief of Clan Clawhaven.",
      "attributes": [
        {
          "trait_type": "Clan",
          "value": "Clan Clawhaven"
        },
        {
          "trait_type": "Class",
          "value": "Paladin"
        },
        {
          "trait_type": "Name",
          "value": "Brooka Clawhaven"
        },
        //          {
        //            "trait_type": "Rarity",
        //            "value": "Mystic"
        //          },
        {
          "trait_type": "Gender",
          "value": "Male"
        },
        {
          "trait_type": "Biome",
          "value": "Forest"
        },
        {
          "trait_type": "Generation",
          "value": "Foundation"
        },
        {
          "trait_type": "Background",
          "value": "Morning Blue"
        },
        {
          "trait_type": "Skin",
          "value": "Light Armor"
        },
        {
          "trait_type": "Pose",
          "value": "Stone Salute"
        }
      ]
    },
    "elephant": {
      "uuid": "",
      "name": "General Dox #",
      "external_url": "https://www.planetmojo.io/champion/",
      "order": 0,
      "type": "Elephant",
      "rarity": "Mystic",
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/champions/ElephantGeneralDox_Base_",
      "isSprouted": "1",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/champions/ElephantGeneralDox_Base.glb",
      "description": "A Queen, Clan Champion and unstoppable if she gets enough momentum - slicing an elephant-sized hole through any defense with her razor-sharp, diamond-encrusted tusks as blows bounce off her battle-hardened hide.",
      "attributes": [
        {
          "trait_type": "Clan",
          "value": "Clan Ivorium"
        },
        {
          "trait_type": "Class",
          "value": "General "
        },
        {
          "trait_type": "Name",
          "value": "General Dox"
        },
        //          {
        //            "trait_type": "Rarity",
        //            "value": "Mystic"
        //          },
        {
          "trait_type": "Gender",
          "value": "Female"
        },
        {
          "trait_type": "Biome",
          "value": "Savannah"
        },
        {
          "trait_type": "Generation",
          "value": "Foundation"
        },
        {
          "trait_type": "Background",
          "value": "Morning Blue"
        },
        {
          "trait_type": "Skin",
          "value": "Light Armor"
        },
        {
          "trait_type": "Pose",
          "value": "Stalwart Staunch"
        },
        {
          "trait_type": "Media Type",
          "value": "3D"
        }
      ]
    },
    "frog": {
      "uuid": "",
      "name": "Froda Swamphag #",
      "external_url": "https://www.planetmojo.io/champion/",
      "order": 1,
      "type": "Frog",
      "rarity": "Mystic",
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/champions/FrogFroda_Base_",
      "isSprouted": "1",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/champions/FrogFroda_Base_",
      "description": "Her bulging eyes allow her to see all things at once. Her brightly colored bumps warn predators of her toxic skin. She is magical, mesmerizing, and a little crazy. She is Froda Swamphag: cold-blooded shaman of Clan Kroker.",
      "attributes": [
        {
          "trait_type": "Clan",
          "value": "Clan Kroker"
        },
        {
          "trait_type": "Class",
          "value": "Shaman"
        },
        {
          "trait_type": "Name",
          "value": "Froda Swamphag"
        },
        //          {
        //            "trait_type": "Rarity",
        //            "value": "Mystic"
        //          },
        {
          "trait_type": "Gender",
          "value": "Female"
        },
        {
          "trait_type": "Biome",
          "value": "Swamp"
        },
        {
          "trait_type": "Generation",
          "value": "Foundation"
        },
        {
          "trait_type": "Background",
          "value": "Murky Magenta"
        },
        {
          "trait_type": "Skin",
          "value": "Light Armor"
        },
        {
          "trait_type": "Pose",
          "value": "Safeguard"
        }
      ]
    },
    "hippo": {
      "uuid": "",
      "name": "Batakamus Rex #",
      "external_url": "https://www.planetmojo.io/champion/",
      "order": 1,
      "type": "Hippo",
      "rarity": "Mystic",
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/champions/HippoBatakamus_Base_",
      "isSprouted": "1",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/champions/HippoBatakamus_Base_",
      "description": "As battle begins, he whips himself into a frenzied bloodlust by howling like a banshee, biting chunks off his armor, and frothing at the mouth. He is deranged, unstoppable, the deadliest butcher on two feet. He is Batakamus Rex, the front-line berserker of Clan Supremus.",
      "attributes": [
        {
          "trait_type": "Clan",
          "value": "Clan Supremus"
        },
        {
          "trait_type": "Class",
          "value": "Berzerker"
        },
        {
          "trait_type": "Name",
          "value": "Batakamus Rex"
        },
        //          {
        //            "trait_type": "Rarity",
        //            "value": "Mystic"
        //          },
        {
          "trait_type": "Gender",
          "value": "Male"
        },
        {
          "trait_type": "Biome",
          "value": "Savannah"
        },
        {
          "trait_type": "Generation",
          "value": "Foundation"
        },
        {
          "trait_type": "Background",
          "value": "Burnt Red"
        },
        {
          "trait_type": "Skin",
          "value": "Light Armor"
        },
        {
          "trait_type": "Pose",
          "value": "Bouncer"
        }
      ]
    },
    "meerkat": {
      "uuid": "",
      "name": "Haile Tibeb #",
      "external_url": "https://www.planetmojo.io/champion/",
      "order": 0,
      "type": "Meerkat",
      "rarity": "Ranger",
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/champions/MeerkatHaile_Base_",
      "isSprouted": "1",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/champions/MeerkatHaile_Base.glb",
      "description": "Haile Tibeb studied and mastered the Sling from an early age, but as he grew older, the Clan Vigil innate ability was noted to be particularly powerful in him he quickly realized that the strategies he found most valuable were those that turned the violence of enemies against themselves.",
      "attributes": [
        {
          "trait_type": "Clan",
          "value": "Clan Vigil"
        },
        {
          "trait_type": "Class",
          "value": "Ranger"
        },
        {
          "trait_type": "Name",
          "value": "Haile Tibeb"
        },
        //          {
        //            "trait_type": "Rarity",
        //            "value": "Mystic"
        //          },
        {
          "trait_type": "Gender",
          "value": "Male"
        },
        {
          "trait_type": "Biome",
          "value": "Savannah"
        },
        {
          "trait_type": "Generation",
          "value": "Foundation"
        },
        {
          "trait_type": "Background",
          "value": "Emerald Majesty"
        },
        {
          "trait_type": "Skin",
          "value": "Light Armor"
        },
        {
          "trait_type": "Pose",
          "value": "Rope Dart"
        },
        {
          "trait_type": "Media Type",
          "value": "3D"
        }
      ]
    },
    "panther": {
      "uuid": "",
      "name": "Dawn Striker #",
      "external_url": "https://www.planetmojo.io/champion/",
      "order": 0,
      "type": "Panther",
      "rarity": "Mystic",
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/champions/PantherDawn_Base_",
      "isSprouted": "1",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/champions/PantherDawn_Base.glb",
      "description": "She is a nocturnal predator with eyes so sharp she can spot prey in total darkness, a nose so keen she can smell the shape of your soul, and a voice so seductive you will not notice the blade in your back until it is too late. As Clan Champion, Dawn can leap great distances and pounce on escaping enemies. Her retractable steel claws can hook onto victims and yank them into her razor sharp maw.",
      "attributes": [
        {
          "trait_type": "Clan",
          "value": "Clan Zama"
        },
        {
          "trait_type": "Class",
          "value": "Huntress"
        },
        {
          "trait_type": "Name",
          "value": "Dawn Striker"
        },
        //          {
        //            "trait_type": "Rarity",
        //            "value": "Mystic"
        //          },
        {
          "trait_type": "Gender",
          "value": "Female"
        },
        {
          "trait_type": "Biome",
          "value": "Jungle"
        },
        {
          "trait_type": "Generation",
          "value": "Foundation"
        },
        {
          "trait_type": "Background",
          "value": "Burnt Orange"
        },
        {
          "trait_type": "Skin",
          "value": "Light Armor"
        },
        {
          "trait_type": "Pose",
          "value": "Prowler"
        },
        {
          "trait_type": "Media Type",
          "value": "3D"
        }
      ]
    },
    "penguin": {
      "uuid": "",
      "name": "Gwyn Rockhopper #",
      "external_url": "https://www.planetmojo.io/champion/",
      "order": 0,
      "type": "Penguin",
      "rarity": "Mystic",
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/champions/PenguinGwyn_Base_",
      "isSprouted": "1",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/champions/PenguinGwyn_Base.glb",
      "description": "An outcast, Gwyn does not seem to fit in on the battlefield, with her tattered robes and limping gait - until she unleashes her mystical spells of artic dark magic.",
      "attributes": [
        {
          "trait_type": "Clan",
          "value": "Clan Glak"
        },
        {
          "trait_type": "Class",
          "value": "Witch"
        },
        {
          "trait_type": "Name",
          "value": "Gwyn Rockhopper"
        },
        //          {
        //            "trait_type": "Rarity",
        //            "value": "Mystic"
        //          },
        {
          "trait_type": "Gender",
          "value": "Female"
        },
        {
          "trait_type": "Biome",
          "value": "Arctic"
        },
        {
          "trait_type": "Generation",
          "value": "Foundation"
        },
        {
          "trait_type": "Background",
          "value": "Midnight Teal"
        },
        {
          "trait_type": "Skin",
          "value": "Light Armor"
        },
        {
          "trait_type": "Pose",
          "value": "Mystic Hex"
        },
        {
          "trait_type": "Media Type",
          "value": "3D"
        }
      ]
    },
    "platypus": {
      "uuid": "",
      "name": "Veren Mostelier #",
      "external_url": "https://www.planetmojo.io/champion/",
      "order": 0,
      "type": "Platypus",
      "rarity": "Rogue",
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/champions/PlatypusVeren_Base_",
      "isSprouted": "1",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/champions/PlatypusVeren_Base.glb",
      "description": "Veren is the descendent of a long line of Umbran rogue assassins who long ago crafted their dark arts, realizing they could match even the most terrifying predator’s strength, without but a scratch by ending that strength. He trains the young assassins in the dark arts of apothecary, the same as he was taught when he was a youth, the same way it has been done for centuries.",
      "attributes": [
        {
          "trait_type": "Clan",
          "value": "Clan Umbran"
        },
        {
          "trait_type": "Class",
          "value": "Rogue"
        },
        {
          "trait_type": "Name",
          "value": "Veren Mostelier"
        },
        //          {
        //            "trait_type": "Rarity",
        //            "value": "Mystic"
        //          },
        {
          "trait_type": "Gender",
          "value": "Male"
        },
        {
          "trait_type": "Biome",
          "value": "River"
        },
        {
          "trait_type": "Generation",
          "value": "Foundation"
        },
        {
          "trait_type": "Background",
          "value": "Venomous Green"
        },
        {
          "trait_type": "Skin",
          "value": "Light Armor"
        },
        {
          "trait_type": "Pose",
          "value": "Deadly Dance"
        },
        {
          "trait_type": "Media Type",
          "value": "3D"
        }
      ]
    },
    "raccoon": {
      "uuid": "",
      "name": "Dark Brightley #",
      "external_url": "https://www.planetmojo.io/champion/",
      "order": 1,
      "type": "Raccoon",
      "rarity": "Mystic",
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/champions/RaccoonDark_Base_",
      "isSprouted": "1",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/champions/RaccoonDark_Base_",
      "description": "She can shoot you through the heart with a silent arrow. Seduce you while dripping poison in your ear. She is smart, adaptive, ferocious.\nShe is Dark Brightley: royal assassin of Clan Furgen.",
      "attributes": [
        {
          "trait_type": "Clan",
          "value": "Clan Furgen"
        },
        {
          "trait_type": "Class",
          "value": "Assassin"
        },
        {
          "trait_type": "Name",
          "value": "Dark Brightley"
        },
        //          {
        //            "trait_type": "Rarity",
        //            "value": "Mystic"
        //          },
        {
          "trait_type": "Gender",
          "value": "Female"
        },
        {
          "trait_type": "Biome",
          "value": "Forest"
        },
        {
          "trait_type": "Generation",
          "value": "Foundation"
        },
        {
          "trait_type": "Background",
          "value": "Midnight Purple"
        },
        {
          "trait_type": "Skin",
          "value": "Light Armor"
        },
        {
          "trait_type": "Pose",
          "value": "Dead Eye"
        }
      ]
    },
    "rhino": {
      "uuid": "",
      "name": "Sumatra Stronghorn #",
      "external_url": "https://www.planetmojo.io/champion/",
      "order": 1,
      "type": "Rhino",
      "rarity": "Mystic",
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/champions/RhinoSuma_Base_",
      "isSprouted": "1",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/champions/RhinoSuma_Base_",
      "description": "The scars on his skin are too many to count. Countless enemies have driven his clan to near-extinction, yet still he survives. The guilt makes him angry, vengeful, out of control. He is Sumatra Stronghorn, the disgraced warlord of Clan Stronghorn.",
      "attributes": [
        {
          "trait_type": "Clan",
          "value": "Clan Stronghorn"
        },
        {
          "trait_type": "Class",
          "value": "Warrrior"
        },
        {
          "trait_type": "Name",
          "value": "Sumatra Stronghorn"
        },
        //          {
        //            "trait_type": "Rarity",
        //            "value": "Mystic"
        //          },
        {
          "trait_type": "Gender",
          "value": "Male"
        },
        {
          "trait_type": "Biome",
          "value": "Savannah"
        },
        {
          "trait_type": "Generation",
          "value": "Foundation"
        },
        {
          "trait_type": "Background",
          "value": "Steely Turquoise"
        },
        {
          "trait_type": "Skin",
          "value": "Light Armor"
        },
        {
          "trait_type": "Pose",
          "value": "Metal Guard"
        }
      ]
    },
    "scorpion": {
      "uuid": "",
      "name": "Deth Kolo #",
      "external_url": "https://www.planetmojo.io/champion/",
      "order": 0,
      "type": "Scorpion",
      "rarity": "Mystic",
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/champions/ScorpionDeth_Base_",
      "isSprouted": "1",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/champions/ScorpionDeth_Base.glb",
      "description": "A skittering assassin of evil, immune to all poisons and potions, yet none are immune to her precise sniper stab that paralyzes victims for a limited time. Avoid close combat with Kolo at all costs. If she pins you down with her claws, there will be no escape from her sting.",
      "attributes": [
        {
          "trait_type": "Clan",
          "value": "Clan Kolo"
        },
        {
          "trait_type": "Class",
          "value": "Assassin"
        },
        {
          "trait_type": "Name",
          "value": "Deth Kolo"
        },
        //          {
        //            "trait_type": "Rarity",
        //            "value": "Mystic"
        //          },
        {
          "trait_type": "Gender",
          "value": "Female"
        },
        {
          "trait_type": "Biome",
          "value": "Desert"
        },
        {
          "trait_type": "Generation",
          "value": "Foundation"
        },
        {
          "trait_type": "Background",
          "value": "Dark Violet"
        },
        {
          "trait_type": "Skin",
          "value": "Light Armor"
        },
        {
          "trait_type": "Pose",
          "value": "Stinging Blight"
        },
        {
          "trait_type": "Media Type",
          "value": "3D"
        }
      ]
    },
    "turtle": {
      "uuid": "",
      "name": "Zerlin the Lesser #",
      "external_url": "https://www.planetmojo.io/champion/",
      "order": 1,
      "type": "Turtle",
      "rarity": "Mystic",
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/champions/TurtleZerlin_Base_",
      "isSprouted": "1",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/champions/TurtleZerlin_Base_",
      "description": "Some say he hatched at the dawn of time. Others say he is so slow, he can stop time with a raise of his gnarled finger. He is bizarre, absent-minded and insanely powerful. He is Zerlin the Lesser, the mad, wandering cleric of Clan Primorda.",
      "attributes": [
        {
          "trait_type": "Clan",
          "value": "Clan Primorda"
        },
        {
          "trait_type": "Class",
          "value": "Cleric"
        },
        {
          "trait_type": "Name",
          "value": "Zerlin the Lesser"
        },
        //          {
        //            "trait_type": "Rarity",
        //            "value": "Mystic"
        //          },
        {
          "trait_type": "Gender",
          "value": "Male"
        },
        {
          "trait_type": "Biome",
          "value": "Swamp"
        },
        {
          "trait_type": "Generation",
          "value": "Foundation"
        },
        {
          "trait_type": "Background",
          "value": "Violet Shadow"
        },
        {
          "trait_type": "Skin",
          "value": "Light Armor"
        },
        {
          "trait_type": "Pose",
          "value": "Peacekeeper"
        }
      ]
    },
    "vulture": {
      "uuid": "",
      "name": "Rackmore Voortom #",
      "external_url": "https://www.planetmojo.io/champion/",
      "order": 1,
      "type": "Vulture",
      "rarity": "Mystic",
      "image": "https://planetmojo-images-prod.s3.amazonaws.com/champions/VultureRackmore_Base_",
      "isSprouted": "1",
      "animation_url": "https://planetmojo-images-prod.s3.amazonaws.com/champions/VultureRackmore_Base_",
      "description": "Rackmor has no illusions of who he is. Reviled by the other clans, he watches the rivalries, betrayals, victories and defeats of those that look down on him patiently waiting to pick at their bones after death. And so it went for centuries until his forebears uncovered the dark magic to raise the dead.",
      "attributes": [
        {
          "trait_type": "Clan",
          "value": "Clan Mortis"
        },
        {
          "trait_type": "Class",
          "value": "Necromancer"
        },
        {
          "trait_type": "Name",
          "value": "Rackmore Voortom"
        },
        //          {
        //            "trait_type": "Rarity",
        //            "value": "Mystic"
        //          },
        {
          "trait_type": "Gender",
          "value": "Male"
        },
        {
          "trait_type": "Biome",
          "value": "Desert"
        },
        {
          "trait_type": "Generation",
          "value": "Foundation"
        },
        {
          "trait_type": "Background",
          "value": "Deep Purple"
        },
        {
          "trait_type": "Skin",
          "value": "Light Armor"
        },
        {
          "trait_type": "Pose",
          "value": "Shrouded Menace"
        }
      ]
    }
  };
  const TypeList = Object.keys(TypeDataList);
  const RarityList = ['Common', "Rare", "Legendary", "Mystic"];

  // Removed this and made this simpler -- only a simple JSON.parse(event.body)
  //   This was needed so I could post this via Postman with the IAM authorization working.
  //   So the POST body needs to be raw data and "Content-Type: application/json"
  //
  //  OVERLY COMPLEX? -- const body = JSON.parse(Buffer.from(event.body, 'base64').toString().trim());
  //

  // Using the body as part of a POST.
  // This should be giving me a JSON body with a TYPE - if blank then random..
  //const body = JSON.parse(Buffer.from(event.body, 'base64').toString())
  const body = JSON.parse(event.body);
  console.log("00 - Show the body : " + JSON.stringify(body));

  let requestType = "";
  if (("requestType" in body) && (body.requestType != null)) {
    requestType = body.requestType;
    console.log("00.PASSED_IN - requestType: " + requestType);
  } else {
    const randomTypeIndex = Math.floor(Math.random() * TypeList.length);
    console.log("00.RANDOM - randomTypeIndex: " + randomTypeIndex);
    requestType = TypeList[randomTypeIndex];
  }
  console.log("0 - Show the requestType : " + requestType);

  let championData = JSON.parse(JSON.stringify(TypeDataList[requestType]));
  console.log ("1 - Show the intial Champion row data after a DEEP COPY : " + JSON.stringify(championData));

  const rarityRandomRoll = Math.random();
  let rarityValue = "nothing"
  if (rarityRandomRoll < 0.9) rarityValue = RarityList[0];
  else if (rarityRandomRoll >= 0.9 && rarityRandomRoll < 0.95) rarityValue = RarityList[1];
  else if (rarityRandomRoll >= 0.95 && rarityRandomRoll < 0.98) rarityValue = RarityList[2];
  else if (rarityRandomRoll >= 0.98 && rarityRandomRoll < 1.0) rarityValue = RarityList[3];
  console.log("2.0 - Show the rarityRandomRoll : " + rarityRandomRoll);
  console.log("2.1 - Show the Rarity : " + rarityValue);

  const orderValue = championData.order;
  console.log("3 - championData.order : " + orderValue);

  // --- 
  let statusCodeVal = 200;
  let bodyValArr = [];

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  console.log("3.05 - dynamodbs: " + JSON.stringify(dynamodb));

  // Get the LastID key from the MetaData
  let scanParams = {
    TableName: process.env.DYNAMODB_CHAMPION_TABLE,
    Key: {
      uuid: "0",
    }, 
    AttributesToGet: ["LastID"],
    ConsistentRead: true,
  };
  console.log("3.1 - scanParams: " + JSON.stringify(scanParams));
  
  let tableMetaData = await dynamodb.get(scanParams).promise();
  console.log("3.2 - tableMetaData: " + JSON.stringify(tableMetaData));

  // Increment lastID by one
  const currentId = tableMetaData["Item"]["LastID"];
  const newId = currentId + 1;

  // begin setting up the variables with the rarityValue and the currentId.
  championData.rarity = rarityValue;
  championData.image += rarityValue + ".jpg"; 
  championData.attributes.push ({ "trait_type": "Rarity", "value": rarityValue });
  if (championData.order) {  
    if (!rarityValue.indexOf(RarityList[0])) 
      championData.animation_url = "";
    else
      championData.animation_url += rarityValue + ".mp4";
  }

  console.log ("3.4 - Show the mid-step Champion row data with correct data: " + JSON.stringify(championData));
  console.log ("3.5 - newId: " + newId);
  console.log ("3.6 - typeof newId: " + typeof newId);

  championData.uuid = newId.toString();
  championData.name += newId.toString();
  championData.external_url += newId.toString();
  championData.order = newId.toString().padStart(6, '0');
  console.log ("4 - Show the final Champion row data with correct data: " + JSON.stringify(championData));

  // Begin the transaction closure
  try {
    const response = await dynamodb.transactWrite({
      TransactItems: [
        {
          //   1- Update the incremented LastID 
          Update: {
            TableName: process.env.DYNAMODB_CHAMPION_TABLE,
            Key: { uuid: "0" },
            "ConditionExpression": "LastID = :currentId",
            "UpdateExpression": "SET LastID = LastID + :incr",
            "ExpressionAttributeValues": {
              ":incr": 1,
              ":currentId": currentId,
            }, 
          },
        },
        {
          //   2- Put in the new row with the information needed
          "Put": {
            TableName: process.env.DYNAMODB_CHAMPION_TABLE, 
            Item: championData, 
          },
          "ConditionalExpression": "attribute_not_exists(uuid)"
        },
      ],
    }).promise();

    bodyValArr = championData; 
    console.log("SUCCESS: " + JSON.stringify(response));
  } catch (error) { 
    // If the transaction fails, then roll back both actions and return a failure service 
    //   409 - The request could not be completed due to a conflict with the current state
    //   of the target resource.  This code is used in sutiaotns where 
    //   the user might be able to resolve the conflict and resumbit the request.
    statusCodeVal = 409
    bodyValArr = { message : "Create Failed. No changed made. Please attempt again." }; 
    console.log("ERROR: " + JSON.stringify(error));
  };

  return {
    statusCode: statusCodeVal,
    body: JSON.stringify(bodyValArr),
  };

}
