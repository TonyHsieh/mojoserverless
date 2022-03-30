'use strict'
const AWS = require('aws-sdk')

module.exports.createMojo = async (event) => {
  const body = JSON.parse(Buffer.from(event.body, 'base64').toString())
  const dynamoDb = new AWS.DynamoDB.DocumentClient()
  const putParams = {
    TableName: process.env.DYNAMODB_MOJO_TABLE,
    Item: {
      uuid: body.uuid,
	body: body.body,
	headpiece: body.headpiece,
	eyebrows: body.eyebrows,
	mojoColor: body.mojoColor,
	facialFeatures: body.facialFeatures,
	eyeColor: body.eyeColor	 
    }
  }
  await dynamoDb.put(putParams).promise()

  return {
    statusCode: 201
  }
}
