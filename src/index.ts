import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  InitiateAuthCommandInput,
  InitiateAuthCommandOutput,
  RespondToAuthChallengeCommand,
  RespondToAuthChallengeCommandInput,
  RespondToAuthChallengeCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import * as crypto from "crypto";

const cognitoClient = new CognitoIdentityProviderClient({ region: "sa-east-1" });

function calculateSecretHash(clientId: string, clientSecret: string, username: string): string {
  const message = username + clientId;
  const hmac = crypto.createHmac("sha256", clientSecret);
  hmac.update(message);
  return hmac.digest("base64");
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Corpo da requisição ausente" }),
    };
  }

  const body = JSON.parse(event.body);
  const { username, password, newPassword } = body;

  if (!username || !password) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Username e password são obrigatórios" }),
    };
  }

  const clientId = process.env.APP_CLIENT_ID; // Certifique-se de definir no Lambda
  const clientSecret = process.env.APP_CLIENT_SECRET; // Certifique-se de definir no Lambda

  if (!clientId || !clientSecret) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "APP_CLIENT_ID ou APP_CLIENT_SECRET não configurados" }),
    };
  }

  const secretHash = calculateSecretHash(clientId, clientSecret, username);

  const params: InitiateAuthCommandInput = {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: clientId,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
      SECRET_HASH: secretHash,
    },
  };

  try {
    const command = new InitiateAuthCommand(params);
    const authResult: InitiateAuthCommandOutput = await cognitoClient.send(command);
    console.log("Resultado da autenticação:", authResult);

    if (authResult.AuthenticationResult) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Login bem-sucedido",
          idToken: authResult.AuthenticationResult.IdToken,
          accessToken: authResult.AuthenticationResult.AccessToken,
          refreshToken: authResult.AuthenticationResult.RefreshToken,
        }),
      };
    } else if (authResult.ChallengeName === "NEW_PASSWORD_REQUIRED") {
      if (!newPassword) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: "Nova senha é obrigatória" }),
        };
      }

      const respondParams: RespondToAuthChallengeCommandInput = {
        ClientId: clientId,
        ChallengeName: "NEW_PASSWORD_REQUIRED",
        Session: authResult.Session,
        ChallengeResponses: {
          USERNAME: username,
          NEW_PASSWORD: newPassword,
          SECRET_HASH: secretHash,
        },
      };

      const respondCommand = new RespondToAuthChallengeCommand(respondParams);
      const respondResult: RespondToAuthChallengeCommandOutput = await cognitoClient.send(respondCommand);

      if (respondResult.AuthenticationResult) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: "Senha atualizada e login bem-sucedido",
            idToken: respondResult.AuthenticationResult.IdToken,
            accessToken: respondResult.AuthenticationResult.AccessToken,
            refreshToken: respondResult.AuthenticationResult.RefreshToken,
          }),
        };
      } else {
        return {
          statusCode: 400,
          body: JSON.stringify({
            message: "Falha ao atualizar senha",
            error: respondResult.ChallengeName || "Desconhecido",
          }),
        };
      }
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Desafio de autenticação necessário",
          challengeName: authResult.ChallengeName,
          challengeParameters: authResult.ChallengeParameters,
        }),
      };
    }
  } catch (error) {
    console.error("Erro de login:", error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Falha no login",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
    };
  }
};
