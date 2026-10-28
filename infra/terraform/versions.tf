terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.80, < 7.0"
    }
  }

  # Estado en S3 (bucket creado por infra/bootstrap), compartido entre tu equipo y GitHub Actions.
  # La configuración va aparte: terraform init -backend-config=backend.hcl (ver backend.hcl.example).
  backend "s3" {}
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.tags
  }
}

# CloudFront solo acepta certificados de ACM emitidos en us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.tags
  }
}
