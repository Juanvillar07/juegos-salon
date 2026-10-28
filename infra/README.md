# Despliegue en AWS con Terraform y GitHub Actions

| Pieza | Servicio | Costo aproximado |
|---|---|---|
| Frontend | S3 (privado) + CloudFront + certificado ACM | ~0–1 USD/mes |
| Backend | Lightsail (1 GB) con Docker: Node + Caddy (HTTPS automático) | ~5–7 USD/mes |
| DNS | Route 53 (zona + registros) | ~0,50 USD/mes + el dominio |
| Estado de Terraform | S3 (versionado) | céntimos |

Con dominio (`domain_name = "salondejuegos.com"`):

```
            salondejuegos.com / www ──► CloudFront ──► S3 (cliente compilado)
                                            │ HTTPS (ACM)
navegador ──┤
            api.salondejuegos.com ─────► Lightsail (IP estática)
                                          └─ Caddy :443 (Let's Encrypt) ─► Node :3001 (Socket.IO)
```

Sin dominio (`domain_name` vacío, el valor por defecto):

```
                                          ┌─ /*            ──► S3 (cliente compilado)
navegador ──► https://xxxx.cloudfront.net ┤
              (certificado de CloudFront) └─ /socket.io/*, /health ──► 1-2-3-4.sslip.io:80
                                                                       └─ Caddy :80 ─► Node :3001
```

Sin dominio, el sitio y la API comparten la URL de CloudFront. CloudFront necesita un nombre DNS para llegar a la instancia, y Lightsail no le da uno. Por eso usa uno de [sslip.io](https://sslip.io), que resuelve a la IP de la instancia (`1-2-3-4.sslip.io` → `1.2.3.4`). Este modo tiene dos limitaciones:

- **Servicio externo:** si sslip.io falla, la API deja de responder; el sitio sigue cargando.
- **Tramo sin cifrar:** el tráfico entre CloudFront y la instancia va por HTTP.

Para pasar a un dominio, pon `domain_name` en `terraform.tfvars` (y en `TERRAFORM_TFVARS`), haz `terraform apply` y despliega el backend y el frontend.

Hay dos stacks de Terraform:

| Carpeta | Qué crea | Quién lo aplica |
|---|---|---|
| `infra/bootstrap/` | Bucket del estado de Terraform, proveedor OIDC de GitHub y los roles de IAM que usa GitHub Actions | Tú, una sola vez |
| `infra/terraform/` | Bucket, CloudFront, certificado, DNS, instancia, IP, firewall y alerta de gasto | Tú la primera vez; después GitHub Actions |

El código se despliega con `scripts/deploy-backend.sh` y `scripts/deploy-frontend.sh`. GitHub Actions usa estos mismos scripts, y también puedes correrlos a mano.

## CI/CD

| Workflow | Cuándo | Qué hace |
|---|---|---|
| `ci.yml` | Cada pull request (y antes de cada despliegue) | `npm test` y `npm run build`; construye la imagen Docker y comprueba que responde `/health`; `terraform fmt` y `validate`; `shellcheck` de los scripts |
| `terraform-plan.yml` | Pull requests que tocan `infra/terraform/` | `terraform plan` con un rol de solo lectura; el plan queda en el resumen del job |
| `deploy.yml` | Cada push a `main` (o a mano desde **Actions → Deploy → Run workflow**) | Corre CI y despliega solo lo que cambió (ver abajo) |

Qué despliega `deploy.yml` según lo que cambió:

- **`infra/terraform/`:** `terraform plan` y después `terraform apply`. Las dos cosas pasan antes de desplegar el código.
- **`server/`, `shared/`, `Dockerfile` o `deploy/`:** el backend.
  - El runner construye la imagen Docker y la envía a la instancia por SSH, así la instancia de 1 GB no tiene que compilar.
  - El firewall de Lightsail solo deja entrar por SSH desde `ssh_allowed_cidrs`. Mientras dura el despliegue, `scripts/lightsail-ssh.sh` abre el puerto 22 a la IP del runner y al terminar restaura las reglas, aunque el despliegue falle.
- **`client/` o `shared/`:** el frontend, que se sube a S3 y se invalida `index.html` en CloudFront.

Los despliegues van de uno en uno. GitHub Actions entra en AWS por OIDC, así que no se guardan claves de AWS en GitHub. Hay dos roles:

- **`plan`:** solo lectura, para los pull requests y el `plan` de `main`.
- **`deploy`:** solo para los jobs del environment `production` de GitHub. No tiene permisos de IAM, así que no puede ampliar sus propios permisos.

## Requisitos

- Terraform ≥ 1.10, AWS CLI v2, `ssh` y `tar`. En Windows, usa **Git Bash** para los scripts.
- Para desplegar a mano también necesitas Node 20+. Si quieres compilar la imagen en tu máquina (`BUILD_LOCALLY=1`), también Docker.
- Credenciales de AWS de administrador para el bootstrap; por ejemplo, `aws login` o `aws configure sso`. Comprueba con `aws sts get-caller-identity`.
- Un **dominio** (opcional; sin él, el sitio queda en la URL de CloudFront):
  - Registrado en **Route 53** (lo más simple): la zona alojada ya existe. Deja `create_hosted_zone = false`.
  - Registrado en otro proveedor: usa `create_hosted_zone = true` y, tras el primer `apply`, pon los `name_servers` del output en tu registrador.

## Primer despliegue

Los comandos se ejecutan desde la raíz del repositorio.

1. **Crea la clave SSH de despliegue.** Es una clave solo para esto, porque su parte privada irá a GitHub:

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/salon_deploy -C salon-deploy -N ""
   ```

2. **Bootstrap:** crea el bucket del estado y los roles de GitHub Actions.
   - Si tu repositorio no es `Juanvillar07/juegos-salon`, o si la cuenta ya tiene el proveedor OIDC de GitHub, copia antes `terraform.tfvars.example` y ajústalo.

   ```bash
   terraform -chdir=infra/bootstrap init
   terraform -chdir=infra/bootstrap apply
   ```

   - Su estado queda en `infra/bootstrap/terraform.tfstate`, fuera de Git. Guárdalo: sin él, cambiar estos roles más adelante es más laborioso.

3. **Configura la infraestructura:**

   ```bash
   terraform -chdir=infra/bootstrap output -raw backend_config > infra/terraform/backend.hcl
   cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
   ```

   En `terraform.tfvars` rellena estos valores:
   - `domain_name`: déjalo comentado si aún no tienes dominio.
   - `ssh_allowed_cidrs`: tu IP con `/32`, que obtienes con `curl https://checkip.amazonaws.com`.
   - `ssh_public_key`: el contenido de `~/.ssh/salon_deploy.pub`.
   - Opcional: `budget_alert_email`, para recibir una alerta de gasto.

4. **(Opcional) Comprueba los identificadores de Lightsail** en tu región. Los valores por defecto son `ubuntu_24_04` y `micro_3_0`:

   ```bash
   aws lightsail get-blueprints --query "blueprints[?isActive && contains(blueprintId, 'ubuntu')].blueprintId"
   aws lightsail get-bundles --query "bundles[?isActive && ramSizeInGb<=``2``].[bundleId,price,ramSizeInGb]" --output table
   ```

5. **Crea la infraestructura** y revisa el plan antes de confirmar:

   ```bash
   cd infra/terraform
   terraform init -backend-config=backend.hcl
   terraform apply
   cd ../..
   ```

   CloudFront tarda unos minutos en propagarse. Con dominio, el certificado se valida solo por DNS. La URL del sitio la da `terraform output site_url`.

6. **Configura GitHub** en **Settings** del repositorio:
   - **Environments → New environment → `production`:**
     - En *Deployment branches* limítalo a `main`.
     - Si quieres aprobar cada despliegue a mano, agrega *Required reviewers*. La aprobación se pide en cada etapa: Terraform, backend y frontend.
   - **Secrets and variables → Actions → Variables:** crea las cinco que muestra este comando: `AWS_REGION`, `AWS_PLAN_ROLE_ARN`, `AWS_DEPLOY_ROLE_ARN`, `TF_STATE_BUCKET` y `TF_STATE_KEY`.

     ```bash
     terraform -chdir=infra/bootstrap output github_variables
     ```

   - **Secrets and variables → Actions → Secrets:**
     - `DEPLOY_SSH_KEY`: el contenido de `~/.ssh/salon_deploy`, la clave privada.
     - `TERRAFORM_TFVARS`: el contenido completo de `infra/terraform/terraform.tfvars`.

7. **Despliega el código.** Tienes dos formas:
   - **Desde GitHub:** sube los cambios a `main`, o lanza **Actions → Deploy → Run workflow**.
   - **A mano**, en Git Bash:

     ```bash
     ./scripts/deploy-backend.sh
     ./scripts/deploy-frontend.sh
     ```

   El primer despliegue del backend espera a que la instancia termine de instalar Docker. Con dominio, Caddy obtiene después el certificado de `api.<dominio>`. El script termina comprobando `<api_url>/health`.

8. Abre la URL de `terraform -chdir=infra/terraform output site_url`.

## Despliegues siguientes

Sube los cambios a `main`: `deploy.yml` se encarga de todo. A mano también funciona:

- **Cambió el servidor o `shared/`:** `./scripts/deploy-backend.sh`. Con `BUILD_LOCALLY=1`, la imagen se construye en tu máquina con Docker en lugar de en la instancia.
- **Cambió el cliente:** `./scripts/deploy-frontend.sh`.
  - Los archivos con hash se cachean un año; `index.html` se revalida siempre y se invalida en CloudFront.
  - Los assets anteriores se conservan, para que quien tenga la página abierta pueda seguir cargando los juegos.
- **Cambió la infraestructura:** `terraform plan` y `terraform apply` en `infra/terraform`. Si cambiaste `terraform.tfvars`, actualiza también el secreto `TERRAFORM_TFVARS`.

Al redesplegar el backend, el contenedor se reinicia en unos segundos y las salas en curso se pierden, porque viven en memoria. Por eso `deploy.yml` solo lo redespliega cuando cambia algo que le afecta.

## Notas

- **SSH:** solo desde `ssh_allowed_cidrs`. GitHub Actions abre su IP de forma temporal.
  - Si tu IP cambia, actualízala en `terraform.tfvars` y en `TERRAFORM_TFVARS`, y ejecuta `terraform apply`.
  - Para entrar a mano: `terraform -chdir=infra/terraform output ssh_command`.
- **Logs:** `ssh -i ~/.ssh/salon_deploy ubuntu@<ip> 'cd /opt/salon/app/deploy && docker compose logs -f app'`.
- **Una sola instancia:** las salas viven en memoria. Para escalar a varias hay que mover el estado a Redis antes.
- **Estado de Terraform:** vive en S3, versionado y con bloqueo (`use_lockfile`). Lo comparten tu máquina y GitHub Actions.
- **Si un despliegue falla a mitad**, el firewall puede quedar con la IP del runner. El siguiente despliegue o un `terraform apply` lo dejan como debe estar.
- **Eliminar todo:**
  1. Vacía el bucket: `aws s3 rm s3://<bucket> --recursive`.
  2. Ejecuta `terraform destroy` en `infra/terraform`.
  3. El bootstrap protege su bucket con `prevent_destroy`: quita esa línea de `infra/bootstrap/state.tf` antes de `terraform destroy` allí.
