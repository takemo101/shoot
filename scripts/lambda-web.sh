#!/usr/bin/env bash
set -euo pipefail

FUNCTION_NAME="${FUNCTION_NAME:-spinach-farming-game}"
AWS_REGION="${AWS_REGION:-ap-northeast-1}"
BUNDLE_DIR=".deploy-bundle"

run_aws() {
  if [[ -n "${AWS_PROFILE:-}" ]]; then
    aws --profile "${AWS_PROFILE}" "$@"
  else
    aws "$@"
  fi
}

usage() {
  cat <<EOF
Usage: $0 <command>

Commands:
  deploy    Build the Vite project and deploy to AWS Lambda Web Functions
  drop      Delete the AWS Lambda Web Function (and its endpoints/revisions & IAM role)
  status    Show the current status and endpoint URL of the Lambda Web Function

Environment variables (optional):
  FUNCTION_NAME   Web Function name (default: spinach-farming-game)
  AWS_REGION      Target AWS region (default: ap-northeast-1)
  AWS_PROFILE     AWS CLI profile name
EOF
}

cmd_deploy() {
  echo "==> [1/3] Building project (TypeScript + Vite)..."
  npm run build

  echo "==> [2/3] Preparing lightweight deployment bundle (${BUNDLE_DIR})..."
  rm -rf "${BUNDLE_DIR}"
  mkdir -p "${BUNDLE_DIR}"
  cp -r dist index.js "${BUNDLE_DIR}/"
  cat > "${BUNDLE_DIR}/package.json" <<JSON
{
  "name": "${FUNCTION_NAME}",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js"
}
JSON

  echo "==> [3/3] Deploying '${FUNCTION_NAME}' to AWS Lambda Web Functions (${AWS_REGION})..."
  run_aws lambda-web deploy \
    --name "${FUNCTION_NAME}" \
    --code "./${BUNDLE_DIR}" \
    --region "${AWS_REGION}" \
    --create

  rm -rf "${BUNDLE_DIR}"
  echo "==> Deployment complete!"
}

cmd_drop() {
  echo "==> Dropping AWS Lambda Web Function '${FUNCTION_NAME}' in ${AWS_REGION}..."
  if run_aws lambda-web get-web-function --function-name "${FUNCTION_NAME}" --region "${AWS_REGION}" >/dev/null 2>&1; then
    run_aws lambda-web delete-web-function \
      --function-name "${FUNCTION_NAME}" \
      --region "${AWS_REGION}"
    echo "✔ Deleted Lambda Web Function '${FUNCTION_NAME}' (including all endpoints and revisions)."
  else
    echo "ℹ️  Lambda Web Function '${FUNCTION_NAME}' does not exist in ${AWS_REGION}."
  fi

  ROLE_NAME="awscli-lambdaweb-${FUNCTION_NAME}"
  if run_aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
    echo "==> Cleaning up execution IAM role '${ROLE_NAME}'..."
    ATTACHED_POLICIES=$(run_aws iam list-attached-role-policies --role-name "${ROLE_NAME}" --query 'AttachedPolicies[].PolicyArn' --output text || true)
    for policy_arn in ${ATTACHED_POLICIES}; do
      run_aws iam detach-role-policy --role-name "${ROLE_NAME}" --policy-arn "${policy_arn}" || true
    done
    INLINE_POLICIES=$(run_aws iam list-role-policies --role-name "${ROLE_NAME}" --query 'PolicyNames[]' --output text || true)
    for policy_name in ${INLINE_POLICIES}; do
      run_aws iam delete-role-policy --role-name "${ROLE_NAME}" --policy-name "${policy_name}" || true
    done
    run_aws iam delete-role --role-name "${ROLE_NAME}" || true
    echo "✔ Deleted IAM role '${ROLE_NAME}'."
  fi

  rm -rf "${BUNDLE_DIR}"
  echo "==> Drop complete!"
}

cmd_status() {
  echo "==> Checking status for '${FUNCTION_NAME}' (${AWS_REGION})..."
  run_aws lambda-web get-web-function \
    --function-name "${FUNCTION_NAME}" \
    --region "${AWS_REGION}"
  run_aws lambda-web list-web-function-endpoints \
    --function-name "${FUNCTION_NAME}" \
    --region "${AWS_REGION}"
}

ACTION="${1:-}"
case "${ACTION}" in
  deploy)
    cmd_deploy
    ;;
  drop|destroy|delete)
    cmd_drop
    ;;
  status)
    cmd_status
    ;;
  *)
    usage
    exit 1
    ;;
esac
