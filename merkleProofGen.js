const fs = require('fs');
//const events = require('events');
//const readline = require('readline');
const { stringify } = require("csv-stringify");
const ethers = require('ethers')
const merkleTreeJS = require('merkletreejs')
const solidityKeccak256 = require("ethers/lib/utils").solidityKeccak256;
const keccak256 = require("keccak256");

console.log("Hello World!");

// SET THE saleId
const saleId = 1;
const padded_saleId = saleId.toString().padStart(6, '0');  
const saleKey = "SALE#" + padded_saleId;

const inputFile = (process.argv.slice(2) != "" ? process.argv.slice(2) : "in.txt");
const outputFile = (process.argv.slice(3) != "" ? process.argv.slice(3) : "out.csv");

console.log("inputFile: " + inputFile);
console.log("outputFile: " + outputFile);

const index_PK          = 0;
const index_SK          = 1;
const index_TYPE        = 2;
const index_walletId    = 3;
const index_walletOrder = 4;
const index_saleId      = 5;
const index_merkleProof = 6;

const columns = [
  "PK",
  "SK", 
  "TYPE",
  "walletId",
  "walletOrder",
  "saleId",
  "merkleProof"
]


// read in a file of walletIds
const allFileContents = fs.readFileSync(inputFile, 'utf-8');
// the filter is to get rid of the last phantom line...
//const inputArray = allFileContents.split(/\r?\n/).filter(element => element);
//const leafArray = inputArray.map((walletId) => { if (walletId != '') { return {'walletId' : walletId} }});

// Split into line array
// the filter is to get rid of the last phantom line...
const leafArray = allFileContents.split(/\r?\n/).filter(element => element);
console.log(leafArray);

// Calculate MerkleLeaves from leafArray
console.log("3 ===================");
const merkleLeaves = leafArray.map((leafId) => { return solidityKeccak256(["address"], [leafId]) } ); 
console.log("4 ===================");
console.log("MerkleLeaves!", merkleLeaves);

// Calculate MerkleTree
const merkleTree = new merkleTreeJS.MerkleTree(merkleLeaves, keccak256, { sort: true, fillDefaultHash: ethers.constants.HashZero });
console.log("MerkelTree: ", merkleTree);

//=======
//
// Calculate a merkle proof for each wallet Id!
//

// setup output buffer
const stringifier = stringify({ header:true, columns: columns});
let row = []; 
row[index_SK] = saleKey;
row[index_TYPE] = "POSTER001";
row[index_saleId] = padded_saleId;
let counter = 0;

// open a new output file for CSV
fs.writeFileSync(outputFile, columns.toString() + "\n");
/*
 const writeableStream = fs.createWriteStream(outputFile);
*/

leafArray.forEach(walletId =>  {
  // Increment counter 
  counter++;
  
  // calculate a merkle proof for each wallet
  console.log("#" + counter + `: Line from file: ${walletId}`);
  // calculate the Leaf
  const leaf = solidityKeccak256(["address"], [walletId]);
  console.log("leaf: ", leaf);

  // calculate the MerkleProof
  const merkleProof = merkleTree.getHexProof(leaf);
  console.log("merkleProof: ", merkleProof);

  // save in an array for later output in CSV format per line
  row[index_PK] = "WALLET#"+walletId;
  row[index_walletId] = walletId;
  row[index_walletOrder] = counter.toString().padStart(6, '0');
  row[index_merkleProof] =  JSON.stringify(merkleProof).replace(/"/g, '""');
  row[index_merkleProof] =  '\"' + row[index_merkleProof] + '\"';

  fs.appendFileSync(outputFile, row.toString() + "\n");
  
  /* 
  // stringifier.write(row);   
  */


});

/*
// output in CSV to a file
stringifier.pipe(writeableStream);
// Close the writable stream
stringifier.end();
*/
// Close the File
fs.close();

// RAM used information...
const used = process.memoryUsage().heapUsed / 1024 / 1024;
console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);


/*
//
// NOTE TO SELF: could not use because we need all of the walletIds to build
// the merkleLeaves for the full merkleTree
//
(async function processLineByLine() {
  try {
    // read in a file of walletIds
    const rl = readline.createInterface({
      input: fs.createReadStream('broadband.sql'),
      crlfDelay: Infinity
    });

    // open a new output file for CSV


    // loop through file - line by line
    rl.on('line', (line) => {
      //   calculate a merkle proof for each wallet
      console.log(`Line from file: ${line}`);


      //   writeout in CSV format per line

    });

    await events.once(rl, 'close');

    console.log('Reading file line by line with readline done.');
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
  } catch (err) {
    console.error(err);
  }
})();

*/
