import { DynamoDB } from 'aws-sdk';
import { v7 as uuidv7 } from 'uuid'; // Para gerar productId único

const dynamoDb = new DynamoDB.DocumentClient();
const tableName = process.env.PRODUCTS_TABLE_NAME!;

export const handler = async (event: any) => {
  const { httpMethod, body, pathParameters } = event;

  try {
    if (httpMethod === 'POST') {
      // Create a new product
      const data = JSON.parse(body);
      const product = {
        productId: uuidv7(), // Generate unique ID
        name: data.name,
        defaultVolume: data.defaultVolume,
        unit: data.unit,
        quantityPerBox: data.quantityPerBox,
        purchasePriceUnit: data.purchasePriceUnit,
        purchasePriceKg: data.purchasePriceKg,
        purchasePriceDozen: data.purchasePriceDozen,
        purchasePriceBox: data.purchasePriceBox,
        salePriceUnit: data.salePriceUnit,
        salePriceKg: data.salePriceKg,
        salePriceDozen: data.salePriceDozen,
        salePriceBox: data.salePriceBox,
        enabled: data.enabled || true,
        notes: data.notes || '',
      };

      await dynamoDb
        .put({
          TableName: tableName,
          Item: product,
        })
        .promise();

      return {
        statusCode: 201,
        body: JSON.stringify({ message: 'Product created', product }),
      };
    }

    if (httpMethod === 'GET') {
      if (pathParameters && pathParameters.id) {
        // Get a specific product
        const { id } = pathParameters;
        const result = await dynamoDb
          .get({
            TableName: tableName,
            Key: { productId: id },
          })
          .promise();

        if (!result.Item) {
          return { statusCode: 404, body: JSON.stringify({ message: 'Product not found' }) };
        }

        return { statusCode: 200, body: JSON.stringify(result.Item) };
      }

      // Get all products
      const result = await dynamoDb.scan({ TableName: tableName }).promise();
      return { statusCode: 200, body: JSON.stringify(result.Items) };
    }

    if (httpMethod === 'PUT') {
      // Update product
      const { id } = pathParameters;
      const data = JSON.parse(body);

      await dynamoDb
        .update({
          TableName: tableName,
          Key: { productId: id },
          UpdateExpression:
            'SET #name = :name, defaultVolume = :defaultVolume, unit = :unit, quantityPerBox = :quantityPerBox, purchasePriceUnit = :purchasePriceUnit, purchasePriceKg = :purchasePriceKg, purchasePriceDozen = :purchasePriceDozen, purchasePriceBox = :purchasePriceBox, salePriceUnit = :salePriceUnit, salePriceKg = :salePriceKg, salePriceDozen = :salePriceDozen, salePriceBox = :salePriceBox, enabled = :enabled, notes = :notes',
          ExpressionAttributeNames: {
            '#name': 'name',
          },
          ExpressionAttributeValues: {
            ':name': data.name,
            ':defaultVolume': data.defaultVolume,
            ':unit': data.unit,
            ':quantityPerBox': data.quantityPerBox,
            ':purchasePriceUnit': data.purchasePriceUnit,
            ':purchasePriceKg': data.purchasePriceKg,
            ':purchasePriceDozen': data.purchasePriceDozen,
            ':purchasePriceBox': data.purchasePriceBox,
            ':salePriceUnit': data.salePriceUnit,
            ':salePriceKg': data.salePriceKg,
            ':salePriceDozen': data.salePriceDozen,
            ':salePriceBox': data.salePriceBox,
            ':enabled': data.enabled,
            ':notes': data.notes,
          },
        })
        .promise();

      return { statusCode: 200, body: JSON.stringify({ message: 'Product updated' }) };
    }

    if (httpMethod === 'DELETE') {
      // Logical delete
      const { id } = pathParameters;

      await dynamoDb
        .update({
          TableName: tableName,
          Key: { productId: id },
          UpdateExpression: 'SET enabled = :enabled',
          ExpressionAttributeValues: {
            ':enabled': false,
          },
        })
        .promise();

      return { statusCode: 200, body: JSON.stringify({ message: 'Product logically deleted' }) };
    }

    return { statusCode: 400, body: JSON.stringify({ message: 'Unsupported HTTP method' }) };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error', error: error }),
    };
  }
};
