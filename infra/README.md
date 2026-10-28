# Despliegue en AWS con Terraform

| Pieza | Servicio | Costo aproximado |
|---|---|---|
| Frontend | S3 (privado) + CloudFront + certificado ACM | ~0–1 USD/mes |
| Backend | Lightsail (1 GB) con Docker: Node + Caddy (HTTPS automático) | ~5–7 USD/mes |
| DNS | Route 53 (zona + registros) | ~0,50 USD/mes + el dominio |

```
            salondejuegos.com / www ──► CloudFront ──► S3 (cliente compilado)
                                            │ HTTPS (ACM)
navegador ──┤
            api.salondejuegos.com ─────► Lightsail (IP estática)
                                          └─ Caddy :443 (Let's Encrypt) ─► Node :3001 (Socket.IO)
```

- **Terraform** crea la infraestructura: bucket, CloudFront, certificado, DNS, instancia, IP y firewall.
- **Los scripts** de `scripts/` despliegan el código: compilan el cliente y lo suben a S3, y envían el servidor a la instancia para construir los contenedores.

Cambiar el código no requiere tocar Terraform.

## Requisitos

- Terraform ≥ 1.6, AWS CLI v2, Node 20+, `ssh` y `tar` (en Windows, usa **Git Bash** para los scripts).
- Credenciales de AWS con permisos sobre S3, CloudFront, ACM, Route 53, Lightsail y Budgets. Por ejemplo, `aws login` o `aws configure sso`; comprueba con `aws sts get-caller-identity`.
- Un **dominio**:
  - Registrado en **Route 53** (lo más simple): la zona alojada se crea sola. Deja `create_hosted_zone = false`.
  - Registrado en otro proveedor: usa `create_hosted_zone = true` y, tras el primer `apply`, pon los `name_servers` del output en tu registrador.
- Una clave SSH. Si no tienes una:

  ```bash
  ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519
  ```

## Primer despliegue

1. **Configura las variables:**

   ```bash
   cd infra/terraform
   cp terraform.tfvars.example terraform.tfvars
   ```

   Edita `domain_name` y `ssh_allowed_cidrs`: tu IP con `/32`, que obtienes con `curl https://checkip.amazonaws.com`. Si quieres una alerta de gasto, agrega `budget_alert_email`.

2. **(Opcional) Comprueba los identificadores de Lightsail** en tu región. Los valores por defecto son `ubuntu_24_04` y `micro_3_0`:

   ```bash
   aws lightsail get-blueprints --query "blueprints[?isActive && contains(blueprintId, 'ubuntu')].blueprintId"
   aws lightsail get-bundles --query "bundles[?isActive && ramSizeInGb<=``2``].[bundleId,price,ramSizeInGb]" --output table
   ```

3. **Crea la infraestructura** (revisa el plan antes de confirmar):

   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

   CloudFront tarda unos minutos en propagarse, y el certificado se valida solo por DNS.

4. **Despliega el backend y el frontend** desde la raíz del repositorio:

   ```bash
   ./scripts/deploy-backend.sh
   ./scripts/deploy-frontend.sh
   ```

   - El primer `deploy-backend.sh` espera a que la instancia termine de instalar Docker. Después Caddy obtiene el certificado de `api.<dominio>`.
   - El script termina comprobando `https://api.<dominio>/health`.

5. Abre `https://<dominio>`.

## Despliegues siguientes

- **Cambió el servidor o `shared/`:** `./scripts/deploy-backend.sh`. Mientras se reinicia el contenedor (unos segundos), las salas en curso se pierden porque viven en memoria.
- **Cambió el cliente:** `./scripts/deploy-frontend.sh`. Los archivos con hash se cachean un año; `index.html` se revalida siempre y se invalida en CloudFront.
- **Cambió la infraestructura:** `terraform plan` y `terraform apply`.

## Notas

- **SSH:** solo desde `ssh_allowed_cidrs`. Si tu IP cambia, actualízala en `terraform.tfvars` y ejecuta `terraform apply`. Entrar a mano: `terraform output ssh_command`.
- **Logs:** `ssh ubuntu@<ip> 'cd /opt/salon/app/deploy && docker compose logs -f app'`.
- **Una sola instancia:** las salas viven en memoria. Para escalar a varias hay que mover el estado a Redis antes.
- **Estado de Terraform:** es local (`terraform.tfstate`, fuera de Git). No lo pierdas: contiene el inventario de lo creado. Para compartirlo, configura un backend S3 en `versions.tf`.
- **Eliminar todo:** `terraform destroy`. Antes vacía el bucket: `aws s3 rm s3://<bucket> --recursive`.
