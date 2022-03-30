'use strict'
const AWS = require('aws-sdk')

module.exports.getMojo = async (event) => {
  const scanParams = {
    TableName: process.env.DYNAMODB_MOJO_TABLE,
    Key: {
      uuid: event.pathParameters.id,
    },
  };

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const result = await dynamodb.get(scanParams).promise();

  return {
    statusCode: 200,
    body: JSON.stringify(result.Item),
  };
}
