import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as fs from 'fs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class LetuceBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // const apiSpec = fs.readFileSync('openapi.yaml', 'utf8'); // Removed unused variable

    const createDynamoDBTable = (id: string, partitionKey: string) => {
      return new dynamodb.Table(this, id, {
        partitionKey: { name: partitionKey, type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        tableName: id,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
    };

    const createLambdaFunction = (id: string, path: string, environment: { [key: string]: string }) => {
      return new lambda.Function(this, id, {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path, {
          bundling: {
            image: lambda.Runtime.NODEJS_22_X.bundlingImage,
            command: ["bash", "-c", "npm install && npm run build && cp -r dist/* /asset-output/index.js"],
          }
        }),
        environment,
      });
    };

    const customersTable = createDynamoDBTable('CustomersTable', 'customerId');
    const purchaseOrdersTable = createDynamoDBTable('PurchaseOrdersTable', 'orderId');
    const salesOrdersTable = createDynamoDBTable('SalesOrdersTable', 'orderId');
    const suppliersTable = createDynamoDBTable('SuppliersTable', 'supplierId');
    const productsTable = createDynamoDBTable('ProductsTable', 'productId');
    const specificPricesTable = createDynamoDBTable('SpecificPricesTable', 'specificPriceId');

    const customersFunction = createLambdaFunction('CustomersFunction', 'src/handlers/customer', {
      CUSTOMERS_TABLE_NAME: customersTable.tableName,
    });

    const salesOrdersFunction = createLambdaFunction('SalesOrdersFunction', 'src/handlers/sales-order', {
      SALES_ORDERS_TABLE_NAME: salesOrdersTable.tableName,
      SPECIFIC_PRICES_TABLE_NAME: specificPricesTable.tableName,
    });

    const purchaseOrdersFunction = createLambdaFunction('PurchaseOrdersFunction', 'src/handlers/purchase-order', {
      PURCHASE_ORDERS_TABLE_NAME: purchaseOrdersTable.tableName,
      SPECIFIC_PRICES_TABLE_NAME: specificPricesTable.tableName,
    });

    const suppliersFunction = createLambdaFunction('SuppliersFunction', 'src/handlers/supplier', {
      SUPPLIERS_TABLE_NAME: suppliersTable.tableName,
    });

    const productsFunction = createLambdaFunction('ProductsFunction', 'src/handlers/product', {
      PRODUCTS_TABLE_NAME: productsTable.tableName,
    });

    const specificPricesFunction = createLambdaFunction('SpecificPricesFunction', 'src/handlers/specific-price', {
      SPECIFIC_PRICES_TABLE_NAME: specificPricesTable.tableName,
    });

    const helloFunction = new lambda.Function(this, 'HelloFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async function(event) {
          return {
            statusCode: 200,
            body: JSON.stringify({ message: "Hello from Lambda!" })
          };
        };
      `),
    });

    const authorizationFunction = createLambdaFunction('AuthorizationFunction', 'src/handlers/auth', {});

    const api = new apigateway.RestApi(this, 'LetuceApiGateway', {
      restApiName: 'Letuce API Gateway',
      description: 'API Gateway for Letuce Backend',
    });

    const lambdaAuthorizer = new apigateway.TokenAuthorizer(this, 'LambdaAuthorizer', {
      handler: authorizationFunction,
    });

    const addApiResource = (resource: apigateway.Resource, methods: string[], lambdaFunction: lambda.Function) => {
      methods.forEach(method => {
        resource.addMethod(method, new apigateway.LambdaIntegration(lambdaFunction), {
          authorizer: lambdaAuthorizer,
          authorizationType: apigateway.AuthorizationType.CUSTOM,
        });
      });
    };

    const helloResource = api.root.addResource('hello');
    addApiResource(helloResource, ['GET'], helloFunction);

    const customersResource = api.root.addResource('customers');
    addApiResource(customersResource, ['POST', 'GET'], customersFunction);

    const customerResource = customersResource.addResource('{id}');
    addApiResource(customerResource, ['GET', 'PUT', 'DELETE'], customersFunction);

    const suppliersResource = api.root.addResource('suppliers');
    addApiResource(suppliersResource, ['POST', 'GET'], suppliersFunction);

    const supplierResource = suppliersResource.addResource('{id}');
    addApiResource(supplierResource, ['GET', 'PUT', 'DELETE'], suppliersFunction);

    const productsResource = api.root.addResource('products');
    addApiResource(productsResource, ['POST', 'GET'], productsFunction);

    const productResource = productsResource.addResource('{id}');
    addApiResource(productResource, ['GET', 'PUT', 'DELETE'], productsFunction);

    const pricesResource = api.root.addResource('specific-prices');
    addApiResource(pricesResource, ['POST', 'GET'], specificPricesFunction);

    const priceResource = pricesResource.addResource('{id}');
    addApiResource(priceResource, ['GET', 'PUT', 'DELETE'], specificPricesFunction);

    customersTable.grantReadWriteData(customersFunction);
    purchaseOrdersTable.grantReadWriteData(purchaseOrdersFunction);
    salesOrdersTable.grantReadWriteData(salesOrdersFunction);
    suppliersTable.grantReadWriteData(suppliersFunction);
    productsTable.grantReadWriteData(productsFunction);
    specificPricesTable.grantReadWriteData(specificPricesFunction);

    const userPool = new cognito.UserPool(this, 'LetuceUserPool', {
      userPoolName: 'LetuceUserPool',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
      },
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'LetuceUserPoolClient', {
      userPool,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'URL da API Gateway',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'ID do Cognito User Pool',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'ID do Cognito User Pool Client',
    });
  }
}
