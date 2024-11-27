import { APIGatewayTokenAuthorizerEvent, PolicyDocument } from 'aws-lambda';

// Helper para criar políticas de autorização
const generatePolicy = (
  principalId: string,
  effect: string,
  resource: string
): { principalId: string; policyDocument: PolicyDocument } => {
  const policyDocument: PolicyDocument = {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'execute-api:Invoke',
       Effect: effect as "Allow" | "Deny",
        Resource: resource,
      },
    ],
  };

  return { principalId, policyDocument };
};

// Lambda Handler
export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<{ principalId: string; policyDocument: PolicyDocument }> => {
  // console.log('Authorization invoked', JSON.stringify(event, null, 2));

  // const token = event.authorizationToken;

  // if (!token || token !== 'allow') {
  //   return generatePolicy('user', 'Deny', event.methodArn);
  // }

  return generatePolicy('user', 'Allow', event.methodArn);
};
