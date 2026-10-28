#!/usr/bin/env bash
# Compila el cliente apuntando al backend de producción, lo sube a S3 e invalida index.html
# en CloudFront. Requiere: terraform apply hecho y credenciales de AWS en el entorno.
#   ./scripts/deploy-frontend.sh
set -euo pipefail
export MSYS_NO_PATHCONV=1 # Git Bash en Windows: no reescribir rutas como /index.html

# En Git Bash, pwd -W da C:/…: terraform y docker son programas de Windows y no entienden /c/….
ROOT="$(cd "$(dirname "$0")/.." && { pwd -W 2>/dev/null || pwd; })"
tf() { terraform -chdir="$ROOT/infra/terraform" output -raw "$1"; }

API_URL="$(tf api_url)"
BUCKET="$(tf s3_bucket)"
DISTRIBUTION="$(tf cloudfront_distribution_id)"

cd "$ROOT"
npm run build -w shared
VITE_SERVER_URL="$API_URL" npm run build -w client

# Archivos con hash en el nombre: caché de un año. El resto (index.html…): revalidar siempre.
# Los assets anteriores no se borran: quien tenga la página abierta aún puede cargar
# los juegos (se cargan bajo demanda) con los nombres de su versión.
aws s3 sync client/dist/assets "s3://$BUCKET/assets" \
  --cache-control "public, max-age=31536000, immutable"
aws s3 sync client/dist "s3://$BUCKET" --delete --exclude "assets/*" \
  --cache-control "no-cache"

aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths "/index.html" "/" >/dev/null
echo "Frontend publicado en $(tf site_url) (backend: $API_URL)"
