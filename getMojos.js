'use strict'
const AWS = require('aws-sdk')

module.exports.getMojos = async (event) => {
  const scanParams = {
    TableName: process.env.DYNAMODB_MOJO_TABLE
  }

  const dynamodb = new AWS.DynamoDB.DocumentClient()
  const result = await dynamodb.scan(scanParams).promise()

  if (result.Count === 0) {
    return {
      statusCode: 404
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      total: result.Count,
      items: await result.Items.map(mojo => {
        return {
        uuid: mojo.uuid,
       	body: mojo.body,
        headpiece: mojo.headpiece,
        eyebrows: mojo.eyebrows,
        mojoColor: mojo.mojoColor,
        facialFeatures: mojo.facialFeatures,
        eyeColor: mojo.eyeColor,
	description: mojo.description,
          }
        })
    })
  }

}
