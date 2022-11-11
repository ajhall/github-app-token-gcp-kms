import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { KeyManagementServiceClient } from "@google-cloud/kms";
import { Octokit } from "@octokit/rest";
import ensureError from "ensure-error";

export const fetchInstallationToken = async ({
  githubApiUrl,
  installationId,
  jwt,
  owner,
  permissions,
  repo,
}: Readonly<{
  githubApiUrl: URL;
  installationId?: number;
  jwt: string;
  owner: string;
  permissions?: Record<string, string>;
  repo: string;
}>): Promise<string> => {
  const octokit = new Octokit({
    auth: jwt,
    baseUrl: githubApiUrl.href.toString().replace(/\/$/, ""),
  });

  if (installationId === undefined) {
    if (!owner || !repo) {
      throw new Error("Either installation_id or repository must be specified");
    }

    try {
      ({
        data: { id: installationId },
      } = await octokit.rest.apps.getRepoInstallation({ owner, repo }));
    } catch (error: unknown) {
      throw new Error(
        "Could not get repo installation. Is the app installed on this repo?",
        { cause: ensureError(error) },
      );
    }
  }

  try {
    const { data: installation } =
      await octokit.rest.apps.createInstallationAccessToken({
        installation_id: installationId,
        permissions,
      });
    return installation.token;
  } catch (error: unknown) {
    throw new Error("Could not create installation access token.", {
      cause: ensureError(error),
    });
  }
};

export const getAppJwt = async function ({
  gcpKmsKeyName,
  gcpKmsKeyRing,
  gcpKmsKeyVersion,
  gcpKmsLocation,
  gcpKmsProjectId,
  githubAppId,
}: {
  gcpKmsKeyName: string;
  gcpKmsKeyRing: string;
  gcpKmsKeyVersion: string;
  gcpKmsLocation: string;
  gcpKmsProjectId: string;
  githubAppId: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = { alg: "RS256", typ: "JWT" };
  const jwtClaim = {
    exp: now + 30, // Token is valid for 30 seconds
    iat: now,
    iss: githubAppId,
  };

  const b64Header = encodeBase64Url(JSON.stringify(jwtHeader));
  const b64Payload = encodeBase64Url(JSON.stringify(jwtClaim));
  const message = b64Header + "." + b64Payload;

  const hash = createHash("sha256").update(message, "utf8").digest();
  const digest = { sha256: hash };

  const kmsClient = new KeyManagementServiceClient();
  const keyVersionPath = kmsClient.cryptoKeyVersionPath(
    gcpKmsProjectId,
    gcpKmsLocation,
    gcpKmsKeyRing,
    gcpKmsKeyName,
    gcpKmsKeyVersion,
  );

  const [signedResponse] = await kmsClient.asymmetricSign({
    digest,
    name: keyVersionPath,
  });

  if (!signedResponse.signature) {
    throw new Error("KMS did not return a valid signature");
  }

  const b64Signature = encodeBase64Url(signedResponse.signature);
  const jwt = message + "." + b64Signature;

  return jwt;
};

const encodeBase64Url = function (input: string | Uint8Array): string {
  return Buffer.from(input).toString("base64url");
};
