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

    /**
     * Helper function to create a DynamoDB table.
     * @param id - The unique identifier for the table.
     * @param partitionKey - The partition key for the table.
     * @returns The created DynamoDB table.
     */
    const createDynamoDBTable = (id: string, partitionKey: string) => {
      return new dynamodb.Table(this, id, {
        partitionKey: { name: partitionKey, type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        tableName: id, // Ensure unique table names
        removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
      });
    };

    /**
     * Helper function to create a Lambda function.
     * @param id - The unique identifier for the Lambda function.
     * @param path - The path to the Lambda function's code.
     * @param environment - Environment variables to pass to the Lambda function.
     * @returns The created Lambda function.
     */
    const createLambdaFunction = (
      id: string,
      environment: { [key: string]: string }
    ) => {
      return new lambda.Function(this, id, {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(`src/handlers/${id}/dist`), // Reference the pre-built code
        environment,
        timeout: cdk.Duration.seconds(10),
      });
    };

    // Create DynamoDB Tables
    const customersTable = createDynamoDBTable('CustomersTable', 'customerId');
    const purchaseOrdersTable = createDynamoDBTable('PurchaseOrdersTable', 'orderId');
    const salesOrdersTable = createDynamoDBTable('SalesOrdersTable', 'orderId');
    const suppliersTable = createDynamoDBTable('SuppliersTable', 'supplierId');
    const productsTable = createDynamoDBTable('ProductsTable', 'productId');
    const specificPricesTable = createDynamoDBTable('SpecificPricesTable', 'specificPriceId');

    // Create Lambda Functions with Environment Variables
    const customersFunction = createLambdaFunction('customer',  {
      CUSTOMERS_TABLE_NAME: customersTable.tableName,
    });

    const salesOrdersFunction = createLambdaFunction('sales-order',  {
      SALES_ORDERS_TABLE_NAME: salesOrdersTable.tableName,
      SPECIFIC_PRICES_TABLE_NAME: specificPricesTable.tableName,
    });

    const purchaseOrdersFunction = createLambdaFunction('purchase-order', {
      PURCHASE_ORDERS_TABLE_NAME: purchaseOrdersTable.tableName,
      SPECIFIC_PRICES_TABLE_NAME: specificPricesTable.tableName,
    });

    const suppliersFunction = createLambdaFunction('supplier', {
      SUPPLIERS_TABLE_NAME: suppliersTable.tableName,
    });

    const productsFunction = createLambdaFunction('product',  {
      PRODUCTS_TABLE_NAME: productsTable.tableName,
    });

    const specificPricesFunction = createLambdaFunction('specific-price', {
      SPECIFIC_PRICES_TABLE_NAME: specificPricesTable.tableName,
    });

    // Grant Read/Write Permissions to Lambda Functions
    customersTable.grantReadWriteData(customersFunction);
    purchaseOrdersTable.grantReadWriteData(purchaseOrdersFunction);
    salesOrdersTable.grantReadWriteData(salesOrdersFunction);
    suppliersTable.grantReadWriteData(suppliersFunction);
    productsTable.grantReadWriteData(productsFunction);
    specificPricesTable.grantReadWriteData(specificPricesFunction);

    // Example Hello Function (Does not interact with DynamoDB)
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
      timeout: cdk.Duration.seconds(5),
    });

    // Create Authorization Lambda Function
    const authorizationFunction = createLambdaFunction('AuthorizationFunction', {});

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'LetuceApiGateway', {
      restApiName: 'Letuce API Gateway',
      description: 'API Gateway for Letuce Backend',
      deployOptions: {
        stageName: 'prod',
      },
    });

    // Create Lambda Authorizer
    const lambdaAuthorizer = new apigateway.TokenAuthorizer(this, 'LambdaAuthorizer', {
      handler: authorizationFunction,
      identitySource: apigateway.IdentitySource.header('Authorization'),
    });

    /**
     * Helper function to add resources and methods to API Gateway.
     * @param resource - The API Gateway resource.
     * @param methods - Array of HTTP methods to add.
     * @param lambdaFunction - The Lambda function to integrate.
     */
    const addApiResource = (
      resource: apigateway.Resource,
      methods: string[],
      lambdaFunction: lambda.Function
    ) => {
      methods.forEach((method) => {
        resource.addMethod(
          method,
          new apigateway.LambdaIntegration(lambdaFunction, {
            proxy: true,
          }),
          {
            authorizer: lambdaAuthorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,
          }
        );
      });
    };

    // Define API Resources and Methods
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

    // Create Cognito User Pool
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
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
    });

    // Create Cognito User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, 'LetuceUserPoolClient', {
      userPool,
      generateSecret: false,
    });

    // Output API URL and Cognito Details
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'URL of the API Gateway',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'ID of the Cognito User Pool',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'ID of the Cognito User Pool Client',
    });
  }
}
