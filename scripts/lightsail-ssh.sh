#!/usr/bin/env bash
# Para GitHub Actions: el firewall de la instancia solo deja entrar por SSH desde ssh_allowed_cidrs,
# y los runners cambian de IP. Este script abre el puerto 22 a la IP del runner mientras dura el
# despliegue y después deja las reglas exactamente como estaban.
#   ./scripts/lightsail-ssh.sh open    # guarda las reglas actuales y añade <ip del runner>/32 al puerto 22
#   ./scripts/lightsail-ssh.sh close   # restaura las reglas guardadas
# Requiere: terraform init hecho, credenciales de AWS, jq.
set -euo pipefail

# En Git Bash, pwd -W da C:/…: terraform y docker son programas de Windows y no entienden /c/….
ROOT="$(cd "$(dirname "$0")/.." && { pwd -W 2>/dev/null || pwd; })"
NAME="$(terraform -chdir="$ROOT/infra/terraform" output -raw lightsail_instance_name)"
SAVED="${RUNNER_TEMP:-/tmp}/lightsail-ports.json"

case "${1:-}" in
  open)
    IP="$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')"
    aws lightsail get-instance-port-states --instance-name "$NAME" --output json |
      jq '[.portStates[] | {fromPort, toPort, protocol, cidrs, ipv6Cidrs, cidrListAliases}
           | with_entries(select(.value != null))]' >"$SAVED"
    jq --arg cidr "$IP/32" '
      def ssh: .fromPort == 22 and .toPort == 22 and .protocol == "tcp";
      if any(.[]; ssh)
      then map(if ssh then .cidrs = ((.cidrs // []) + [$cidr] | unique) else . end)
      else . + [{fromPort: 22, toPort: 22, protocol: "tcp", cidrs: [$cidr]}]
      end' "$SAVED" >"$SAVED.open"
    aws lightsail put-instance-public-ports --instance-name "$NAME" --port-infos "file://$SAVED.open" >/dev/null
    echo "SSH abierto temporalmente para $IP en $NAME"
    ;;
  close)
    aws lightsail put-instance-public-ports --instance-name "$NAME" --port-infos "file://$SAVED" >/dev/null
    echo "Firewall de $NAME restaurado"
    ;;
  *)
    echo "Uso: $0 open|close" >&2
    exit 2
    ;;
esac
