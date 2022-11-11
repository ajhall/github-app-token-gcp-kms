import { getInput, info, setFailed, setOutput, setSecret } from "@actions/core";
import ensureError from "ensure-error";
import {
  fetchInstallationToken,
  getAppJwt,
} from "./fetch-installation-token.js";

const run = async () => {
  try {
    const gcpKmsKeyRing = getInput("gcp_kms_key_ring", { required: true });
    const gcpKmsKeyName = getInput("gcp_kms_key_name", { required: true });
    const gcpKmsKeyVersion = getInput("gcp_kms_key_version", {
      required: true,
    });
    const gcpKmsLocation = getInput("gcp_kms_location", { required: true });
    const gcpKmsProjectId = getInput("gcp_kms_project_id", { required: true });

    const appId = getInput("app_id", { required: true });

    const installationIdInput = getInput("installation_id");
    const installationId = installationIdInput
      ? Number(installationIdInput)
      : undefined;

    const permissionsInput = getInput("permissions");
    const permissions = permissionsInput
      ? (JSON.parse(permissionsInput) as Record<string, string>)
      : undefined;

    const repositoryInput = getInput("repository");
    const [owner, repo] = repositoryInput.split("/");

    const githubApiUrlInput = getInput("github_api_url", { required: true });
    const githubApiUrl = new URL(githubApiUrlInput);

    if (!installationId && !repositoryInput) {
      throw new Error("Either installation_id or repository must be specified");
    }

    const jwt = await getAppJwt({
      gcpKmsKeyName,
      gcpKmsKeyRing,
      gcpKmsKeyVersion,
      gcpKmsLocation,
      gcpKmsProjectId,
      githubAppId: appId,
    });

    const installationToken = await fetchInstallationToken({
      githubApiUrl,
      installationId,
      jwt,
      owner,
      permissions,
      repo,
    });

    setSecret(installationToken);
    setOutput("token", installationToken);
    info("Token generated successfully!");
  } catch (_error: unknown) {
    const error = ensureError(_error);
    setFailed(error);
  }
};

void run();
