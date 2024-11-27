import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const dynamoDb = new DynamoDB.DocumentClient();
const purchaseOrdersTable = process.env.PURCHASE_ORDERS_TABLE_NAME!;
const specificPricesTable = process.env.SPECIFIC_PRICES_TABLE_NAME!;

export const handler = async (event: any) => {
  const { httpMethod, body, pathParameters } = event;

  try {
    if (httpMethod === 'POST') {
      const data = JSON.parse(body);

      const products = await Promise.all(
        data.products.map(async (product: any) => {
        
          const specificPrice = await getSpecificPrice(data.supplierId, product.productId);
          const price = specificPrice || product.price; 
          const subtotal = price * product.quantity;

          return {
            productId: product.productId,
            quantity: product.quantity,
            price,
            subtotal,
          };
        })
      );

      const totalPrice = products.reduce((total: number, product: any) => total + product.subtotal, 0);

      const order = {
        orderId: uuidv4(),
        supplierId: data.supplierId,
        products,
        totalPrice,
        status: 'Pendente',
        createdAt: new Date().toISOString(),
        notes: data.notes || '',
      };

      await dynamoDb
        .put({
          TableName: purchaseOrdersTable,
          Item: order,
        })
        .promise();

      return {
        statusCode: 201,
        body: JSON.stringify({ message: 'Purchase order created', order }),
      };
    }

    if (httpMethod === 'GET') {
      if (pathParameters && pathParameters.id) {
        // Obter pedido de compra por ID
        const { id } = pathParameters;

        const result = await dynamoDb
          .get({
            TableName: purchaseOrdersTable,
            Key: { orderId: id },
          })
          .promise();

        if (!result.Item) {
          return { statusCode: 404, body: JSON.stringify({ message: 'Purchase order not found' }) };
        }

        return { statusCode: 200, body: JSON.stringify(result.Item) };
      }

      // Obter todos os pedidos de compra
      const result = await dynamoDb.scan({ TableName: purchaseOrdersTable }).promise();
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

const getSpecificPrice = async (supplierId: string, productId: string): Promise<number | null> => {
  const result = await dynamoDb
    .query({
      TableName: specificPricesTable,
      IndexName: 'EntityProductIndex', 
      KeyConditionExpression: 'entityId = :supplierId AND productId = :productId',
      ExpressionAttributeValues: {
        ':supplierId': supplierId,
        ':productId': productId,
      },
    })
    .promise();

  return result.Items && result.Items.length > 0 ? result.Items[0].price : null;
};
