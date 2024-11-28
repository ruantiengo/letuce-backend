import DynamoDB = require("aws-sdk/clients/dynamodb")
import { v7 as uuidv7 } from 'uuid'; // For auto-generating supplierId

const dynamoDb = new DynamoDB.DocumentClient();
const tableName = "SuppliersTable";

export const handler = async (event: any) => {
  const { httpMethod, body, pathParameters } = event;

  try {
    if (httpMethod === 'POST') {
      // Create a new supplier
      const data = JSON.parse(body);
      const supplier = {
        supplierId: uuidv7(), // Generate unique ID
        name: data.name,
        email: data.email,
        address: data.address,
        contacts: data.contacts || [],
        headOffice: data.headOffice || null,
        cpfCnpj: data.cpfCnpj,
        birthDate: data.birthDate || new Date().toISOString(),
        enabled: data.enabled || true,
        notes: data.notes || '',
      };

      await dynamoDb
        .put({
          TableName: tableName,
          Item: supplier,
        })
        .promise();

      return {
        statusCode: 201,
        body: JSON.stringify({ message: 'Supplier created', supplier }),
      };
    }

    if (httpMethod === 'GET') {
      if (pathParameters && pathParameters.id) {
        // Get a specific supplier
        const { id } = pathParameters;
        const result = await dynamoDb
          .get({
            TableName: tableName,
            Key: { supplierId: id },
          })
          .promise();

        if (!result.Item) {
          return { statusCode: 404, body: JSON.stringify({ message: 'Supplier not found' }) };
        }

        return { statusCode: 200, body: JSON.stringify(result.Item) };
      }

      // Get all suppliers
      const result = await dynamoDb.scan({ TableName: tableName }).promise();
      return { statusCode: 200, body: JSON.stringify(result.Items) };
    }

    if (httpMethod === 'PUT') {
      // Update supplier
      const { id } = pathParameters;
      const data = JSON.parse(body);

      await dynamoDb
        .update({
          TableName: tableName,
          Key: { supplierId: id },
          UpdateExpression:
            'SET #name = :name, email = :email, address = :address, contacts = :contacts, headOffice = :headOffice, enabled = :enabled, notes = :notes',
          ExpressionAttributeNames: {
            '#name': 'name',
          },
          ExpressionAttributeValues: {
            ':name': data.name,
            ':email': data.email,
            ':address': data.address,
            ':contacts': data.contacts,
            ':headOffice': data.headOffice,
            ':enabled': data.enabled,
            ':notes': data.notes,
          },
        })
        .promise();

      return { statusCode: 200, body: JSON.stringify({ message: 'Supplier updated' }) };
    }

    if (httpMethod === 'DELETE') {
      // Logical delete
      const { id } = pathParameters;

      await dynamoDb
        .update({
          TableName: tableName,
          Key: { supplierId: id },
          UpdateExpression: 'SET enabled = :enabled',
          ExpressionAttributeValues: {
            ':enabled': false,
          },
        })
        .promise();

      return { statusCode: 200, body: JSON.stringify({ message: 'Supplier logically deleted' }) };
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
