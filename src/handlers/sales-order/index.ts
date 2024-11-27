import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const dynamoDb = new DynamoDB.DocumentClient();
const salesOrdersTable = process.env.SALES_ORDERS_TABLE_NAME!;
const specificPricesTable = process.env.SPECIFIC_PRICES_TABLE_NAME!;

export const handler = async (event: any) => {
  const { httpMethod, body, pathParameters } = event;

  try {
    if (httpMethod === 'POST') {
      // Criar um novo pedido de venda
      const data = JSON.parse(body);

      const products = await Promise.all(
        data.products.map(async (product: any) => {
          // Verificar preço específico para o cliente no SpecificPricesTable
          const specificPrice = await getSpecificPrice(data.customerId, product.productId);
          const price = specificPrice || product.price; // Usar preço específico ou preço padrão
          const subtotal = price * product.quantity;

          return {
            productId: product.productId,
            quantity: product.quantity,
            price,
            subtotal,
          };
        })
      );

      // Calcular preço total
      const totalPrice = products.reduce((total: number, product: any) => total + product.subtotal, 0);

      const order = {
        orderId: uuidv4(),
        customerId: data.customerId,
        products,
        totalPrice,
        status: 'Pendente',
        createdAt: new Date().toISOString(),
        notes: data.notes || '',
      };

      await dynamoDb
        .put({
          TableName: salesOrdersTable,
          Item: order,
        })
        .promise();

      return {
        statusCode: 201,
        body: JSON.stringify({ message: 'Sales order created', order }),
      };
    }

    if (httpMethod === 'GET') {
      if (pathParameters && pathParameters.id) {
        // Obter pedido de venda por ID
        const { id } = pathParameters;

        const result = await dynamoDb
          .get({
            TableName: salesOrdersTable,
            Key: { orderId: id },
          })
          .promise();

        if (!result.Item) {
          return { statusCode: 404, body: JSON.stringify({ message: 'Sales order not found' }) };
        }

        return { statusCode: 200, body: JSON.stringify(result.Item) };
      }

      // Obter todos os pedidos de venda
      const result = await dynamoDb.scan({ TableName: salesOrdersTable }).promise();
      return { statusCode: 200, body: JSON.stringify(result.Items) };
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

// Função auxiliar para buscar preço específico para o cliente e produto
const getSpecificPrice = async (customerId: string, productId: string): Promise<number | null> => {
  const result = await dynamoDb
    .query({
      TableName: specificPricesTable,
      IndexName: 'EntityProductIndex', // Configure um índice secundário global
      KeyConditionExpression: 'entityId = :customerId AND productId = :productId',
      ExpressionAttributeValues: {
        ':customerId': customerId,
        ':productId': productId,
      },
    })
    .promise();

  return result.Items && result.Items.length > 0 ? result.Items[0].price : null;
};
