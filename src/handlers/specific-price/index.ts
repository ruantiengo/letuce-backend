import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid'; // Para gerar IDs únicos

const dynamoDb = new DynamoDB.DocumentClient();
const tableName = process.env.SPECIFIC_PRICES_TABLE_NAME!;

export const handler = async (event: any) => {
  const { httpMethod, body, pathParameters } = event;

  try {
    if (httpMethod === 'POST') {
      // Criar um preço específico
      const data = JSON.parse(body);
      const specificPrice = {
        specificPriceId: uuidv4(), // Gerar ID único
        entityType: data.entityType, // 'cliente' ou 'fornecedor'
        entityId: data.entityId,
        productId: data.productId,
        price: data.price,
        notes: data.notes || '',
      };

      await dynamoDb
        .put({
          TableName: tableName,
          Item: specificPrice,
        })
        .promise();

      return {
        statusCode: 201,
        body: JSON.stringify({ message: 'Specific price created', specificPrice }),
      };
    }

    if (httpMethod === 'GET') {
      if (pathParameters && pathParameters.id) {
        // Obter um preço específico
        const { id } = pathParameters;
        const result = await dynamoDb
          .get({
            TableName: tableName,
            Key: { specificPriceId: id },
          })
          .promise();

        if (!result.Item) {
          return { statusCode: 404, body: JSON.stringify({ message: 'Specific price not found' }) };
        }

        return { statusCode: 200, body: JSON.stringify(result.Item) };
      }

      // Obter todos os preços específicos
      const result = await dynamoDb.scan({ TableName: tableName }).promise();
      return { statusCode: 200, body: JSON.stringify(result.Items) };
    }

    if (httpMethod === 'PUT') {
      // Atualizar um preço específico
      const { id } = pathParameters;
      const data = JSON.parse(body);

      await dynamoDb
        .update({
          TableName: tableName,
          Key: { specificPriceId: id },
          UpdateExpression: 'SET entityType = :entityType, entityId = :entityId, productId = :productId, price = :price, notes = :notes',
          ExpressionAttributeValues: {
            ':entityType': data.entityType,
            ':entityId': data.entityId,
            ':productId': data.productId,
            ':price': data.price,
            ':notes': data.notes,
          },
        })
        .promise();

      return { statusCode: 200, body: JSON.stringify({ message: 'Specific price updated' }) };
    }

    if (httpMethod === 'DELETE') {
      // Excluir um preço específico
      const { id } = pathParameters;

      await dynamoDb
        .delete({
          TableName: tableName,
          Key: { specificPriceId: id },
        })
        .promise();

      return { statusCode: 200, body: JSON.stringify({ message: 'Specific price deleted' }) };
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
