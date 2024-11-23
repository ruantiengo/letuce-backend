import { CognitoIdentityProviderClient, InitiateAuthCommand, InitiateAuthCommandInput, InitiateAuthCommandOutput } from "@aws-sdk/client-cognito-identity-provider";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const cognitoClient = new CognitoIdentityProviderClient({ region: "sa-east-1" }); // Substitua pela sua região

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Corpo da requisição ausente" })
    };
  }

  const body = JSON.parse(event.body);
  const { username, password } = body;

  if (!username || !password) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Username e password são obrigatórios" })
    };
  }

  const params: InitiateAuthCommandInput = {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: process.env.APP_CLIENT_ID,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password
    }
  };

  try {
    const command = new InitiateAuthCommand(params);
    const authResult: InitiateAuthCommandOutput = await cognitoClient.send(command);

    if (authResult.AuthenticationResult) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Login bem-sucedido",
          idToken: authResult.AuthenticationResult.IdToken,
          accessToken: authResult.AuthenticationResult.AccessToken,
          refreshToken: authResult.AuthenticationResult.RefreshToken
        })
      };
    } else {
      throw new Error("Resultado da autenticação é indefinido");
    }
  } catch (error) {
    console.error("Erro de login:", error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Falha no login",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      })
    };
  }
};

