# GitHub App Token (GCP KMS)

This [JavaScript GitHub Action](https://help.github.com/en/actions/building-actions/about-actions#javascript-actions) can be used to impersonate a GitHub App when `secrets.GITHUB_TOKEN`'s limitations are too restrictive and a personal access token is not suitable.

For instance, from [GitHub Actions' docs](https://docs.github.com/en/actions/using-workflows/triggering-a-workflow#triggering-a-workflow-from-a-workflow):

> When you use the repository's `GITHUB_TOKEN` to perform tasks, events triggered by the `GITHUB_TOKEN`, with the exception of `workflow_dispatch` and `repository_dispatch`, will not create a new workflow run.
> This prevents you from accidentally creating recursive workflow runs.
> For example, if a workflow run pushes code using the repository's `GITHUB_TOKEN`, a new workflow will not run even when the repository contains a workflow configured to run when push events occur.

A workaround is to use a [personal access token](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line) from a [personal user/bot account](https://help.github.com/en/github/getting-started-with-github/types-of-github-accounts#personal-user-accounts).
However, for organizations, GitHub Apps are [a more appropriate automation solution](https://developer.github.com/apps/differences-between-apps/#machine-vs-bot-accounts).

Instead of accepting a private key directly, this action uses [Google Cloud KMS](https://cloud.google.com/security-key-management) to sign the JWT used to retrieve the app installation token.

# Example Workflow

```yml
jobs:
  job:
    runs-on: ubuntu-latest
    permissions:
      contents: 'read'
      id-token: 'write'
    steps:
      # actions/checkout MUST come before auth
      - uses: 'actions/checkout@v3'

      - id: 'auth'
        name: 'Authenticate to Google Cloud'
        uses: 'google-github-actions/auth@v1'
        with:
          workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
          service_account: 'my-service-account@my-project.iam.gserviceaccount.com'

      - name: Generate GitHub App token
        id: generate_token
        uses: ajhall/github-app-token-gcp-kms@v1
        with:
          gcp_kms_key_ring: my-key-ring
          gcp_kms_key_name: my-key-name
          gcp_kms_key_version: 1
          gcp_kms_location: us-east1
          gcp_kms_project_id: my-project

          app_id: ${{ secrets.APP_ID }}

          # Optional. Defaults to the ID of the repository's installation.
          # installation_id: 1337

          # Optional. Defaults to the current repo.
          # repository: owner/repo

          # Optional.
          # Using a YAML multiline string to avoid escaping the JSON quotes.
          # permissions: >-
          #   {"members": "read"}

          # Optional.
          # github_api_url: https://api.example.com

      - name: Use token
        env:
          TOKEN: ${{ steps.generate_token.outputs.token }}
        run: |
          echo "The generated token is masked: ${TOKEN}"
```
