import { DynamoDB } from 'aws-sdk';
import { v7 as uuidv7 } from 'uuid';

const dynamoDb = new DynamoDB.DocumentClient();
const tableName = process.env.CUSTOMERS_TABLE_NAME!;

export const handler = async (event: any) => {
  const { httpMethod, pathParameters, queryStringParameters, body } = event;

  try {
    if (httpMethod === 'POST') {
      // Criar um novo cliente
      const data = JSON.parse(body);
      const customer = {
        customerId: uuidv7(),
        nome: data.nome,
        email: data.email,
        cpfCnpj: data.cpfCnpj,
        dataNascimento: data.dataNascimento,
        endereco: data.endereco,
        contatos: data.contatos || [],
        habilitado: data.habilitado || false,
        observacao: data.observacao || '',
        sacLider: data.sacLider || null,
        isDeleted: false, // Exclusão lógica
      };

      await dynamoDb
        .put({
          TableName: tableName,
          Item: customer,
        })
        .promise();

      return {
        statusCode: 201,
        body: JSON.stringify({ message: 'Customer created', customer }),
      };
    }

    if (httpMethod === 'GET') {
      if (pathParameters && pathParameters.id) {
        // Obter cliente específico
        const { id } = pathParameters;
        const result = await dynamoDb
          .get({
            TableName: tableName,
            Key: { customerId: id },
          })
          .promise();

        if (!result.Item || result.Item.isDeleted) {
          return { statusCode: 404, body: JSON.stringify({ message: 'Customer not found' }) };
        }

        return { statusCode: 200, body: JSON.stringify(result.Item) };
      }

      // Obter todos os clientes (não deletados logicamente)
      const result = await dynamoDb
        .scan({
          TableName: tableName,
          FilterExpression: 'isDeleted = :isDeleted',
          ExpressionAttributeValues: { ':isDeleted': false },
        })
        .promise();

      return { statusCode: 200, body: JSON.stringify(result.Items) };
    }

    if (httpMethod === 'PUT') {
      // Atualizar cliente
      const { id } = pathParameters;
      const data = JSON.parse(body);

      await dynamoDb
        .update({
          TableName: tableName,
          Key: { customerId: id },
          UpdateExpression:
            'SET #nome = :nome, email = :email, cpfCnpj = :cpfCnpj, dataNascimento = :dataNascimento, endereco = :endereco, contatos = :contatos, habilitado = :habilitado, observacao = :observacao, sacLider = :sacLider',
          ExpressionAttributeNames: {
            '#nome': 'nome',
          },
          ExpressionAttributeValues: {
            ':nome': data.nome,
            ':email': data.email,
            ':cpfCnpj': data.cpfCnpj,
            ':dataNascimento': data.dataNascimento,
            ':endereco': data.endereco,
            ':contatos': data.contatos,
            ':habilitado': data.habilitado,
            ':observacao': data.observacao,
            ':sacLider': data.sacLider,
          },
        })
        .promise();

      return { statusCode: 200, body: JSON.stringify({ message: 'Customer updated' }) };
    }

    if (httpMethod === 'DELETE') {
      // Exclusão lógica
      const { id } = pathParameters;

      await dynamoDb
        .update({
          TableName: tableName,
          Key: { customerId: id },
          UpdateExpression: 'SET isDeleted = :isDeleted',
          ExpressionAttributeValues: {
            ':isDeleted': true,
          },
        })
        .promise();

      return { statusCode: 200, body: JSON.stringify({ message: 'Customer deleted logically' }) };
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
