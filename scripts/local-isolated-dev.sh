#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${CHATBOTX_DEV_ENV_FILE:-${REPO_ROOT}/.env.isolated-dev}"
COMPOSE_FILE="${REPO_ROOT}/docker-compose.isolated-dev.yml"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "找不到隔離開發環境設定：${ENV_FILE}" >&2
  echo "請先複製 docker-compose.isolated-dev.env.example 為 .env.isolated-dev。" >&2
  exit 1
fi

compose() {
  docker compose \
    --env-file "${ENV_FILE}" \
    -f "${COMPOSE_FILE}" \
    -p chatbotx-dev \
    "$@"
}

case "${1:-status}" in
  start)
    compose up -d postgres redis filesystem filesystem-init mailhog adminer redis-ui
    compose ps
    ;;
  stop)
    compose stop
    ;;
  status)
    compose ps
    ;;
  migrate)
    set -a
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
    set +a
    cd "${REPO_ROOT}"
    pnpm --filter @chatbotx.io/database db:migrate
    ;;
  seed)
    set -a
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
    set +a
    cd "${REPO_ROOT}"
    pnpm --filter @chatbotx.io/database db:seed
    ;;
  setup)
    "$0" start
    "$0" migrate
    "$0" seed
    ;;
  app)
    set -a
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
    set +a
    cd "${REPO_ROOT}"
    pnpm dev
    ;;
  *)
    echo "用法：$0 {start|stop|status|migrate|seed|setup|app}" >&2
    exit 2
    ;;
esac
