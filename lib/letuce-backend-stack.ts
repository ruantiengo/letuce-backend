import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as fs from 'fs';

export class LetuceBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const apiSpec = fs. readFileSync('openapi.yaml', 'utf8');
    
    // 1. Criar o User Pool do Cognito
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

    // 2. Criar o User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, 'LetuceUserPoolClient', {
      userPool,
    });

    // 3. Criar a Lambda Function
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

        // Lambda: Authorization Function
    const authorizationFunction = new lambda.Function(this, 'AuthorizationFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('src/handlers/authorization'),
    });

    // 4. Configurar o API Gateway
    const api = new apigateway.RestApi(this, 'LetuceApiGateway', {
      restApiName: 'Letuce API Gateway',
      description: 'API Gateway for Letuce Backend',
    });

    // Lambda Authorizer
    const lambdaAuthorizer = new apigateway.TokenAuthorizer(this, 'LambdaAuthorizer', {
      handler: authorizationFunction,
    }); 

    // 6. Configurar o recurso `/hello` no API Gateway

    const helloResource = api.root.addResource('hello');
    helloResource.addMethod('GET', new apigateway.LambdaIntegration(helloFunction), {
      authorizer: lambdaAuthorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // 7. Outputs (opcional)
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
