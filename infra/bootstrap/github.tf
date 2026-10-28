# GitHub Actions se autentica con OIDC: sin claves de AWS guardadas en GitHub.
#   - plan:   solo lectura. Lo asumen los pull requests y los pushes a main (terraform plan).
#   - deploy: crea y cambia la infraestructura y publica el código. Solo los jobs del
#             environment de GitHub (production), que puede exigir aprobación manual.

locals {
  oidc_host = "token.actions.githubusercontent.com"
  oidc_provider_arn = (
    var.create_github_oidc_provider
    ? aws_iam_openid_connect_provider.github[0].arn
    : data.aws_iam_openid_connect_provider.github[0].arn
  )
}

resource "aws_iam_openid_connect_provider" "github" {
  count           = var.create_github_oidc_provider ? 1 : 0
  url             = "https://${local.oidc_host}"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1", "1c58a3a8518e8759bf075b76b750d4f2df264fcd"]
}

data "aws_iam_openid_connect_provider" "github" {
  count = var.create_github_oidc_provider ? 0 : 1
  url   = "https://${local.oidc_host}"
}

data "aws_iam_policy_document" "trust" {
  for_each = {
    plan = [
      "repo:${var.github_repository}:pull_request",
      "repo:${var.github_repository}:ref:refs/heads/main",
    ]
    deploy = ["repo:${var.github_repository}:environment:${var.github_environment}"]
  }

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.oidc_host}:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.oidc_host}:sub"
      values   = each.value
    }
  }
}

# ---------------------------------------------------------------- plan

data "aws_iam_policy_document" "plan" {
  statement {
    sid       = "ReadState"
    actions   = ["s3:ListBucket", "s3:GetObject"]
    resources = [aws_s3_bucket.tfstate.arn, "${aws_s3_bucket.tfstate.arn}/*"]
  }

  # Lo que terraform plan necesita leer para comparar con lo que existe.
  statement {
    sid = "ReadInfrastructure"
    actions = [
      "acm:Describe*", "acm:Get*", "acm:List*",
      "cloudfront:Describe*", "cloudfront:Get*", "cloudfront:List*",
      "route53:Get*", "route53:List*",
      "lightsail:Get*",
      "budgets:View*", "budgets:ListTagsForResource",
    ]
    resources = ["*"]
  }

  # Configuración del bucket del frontend (no sus objetos).
  statement {
    sid       = "ReadWebBucketConfig"
    actions   = ["s3:Get*", "s3:List*"]
    resources = [local.web_bucket_arn]
  }
}

resource "aws_iam_role" "plan" {
  name               = "${var.project_name}-github-plan"
  assume_role_policy = data.aws_iam_policy_document.trust["plan"].json
}

resource "aws_iam_role_policy" "plan" {
  name   = "terraform-plan"
  role   = aws_iam_role.plan.id
  policy = data.aws_iam_policy_document.plan.json
}

# ---------------------------------------------------------------- deploy

data "aws_iam_policy_document" "deploy" {
  # Estado: leer, escribir y el archivo de bloqueo (.tflock).
  statement {
    sid       = "ListState"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.tfstate.arn]
  }

  statement {
    sid     = "WriteState"
    actions = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = [
      "${aws_s3_bucket.tfstate.arn}/${local.state_key}",
      "${aws_s3_bucket.tfstate.arn}/${local.state_key}.tflock",
    ]
  }

  # terraform apply de infra/terraform. Ninguno de sus recursos es de IAM, así que este rol
  # no puede darse más permisos a sí mismo.
  statement {
    sid = "ManageInfrastructure"
    actions = [
      "acm:*",
      "cloudfront:*",
      "route53:*",
      "lightsail:*",
      "budgets:*",
    ]
    resources = ["*"]
  }

  # Bucket del frontend: crearlo, configurarlo y publicar el cliente (aws s3 sync).
  statement {
    sid       = "ManageWebBucket"
    actions   = ["s3:*"]
    resources = [local.web_bucket_arn, "${local.web_bucket_arn}/*"]
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${var.project_name}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.trust["deploy"].json
}

resource "aws_iam_role_policy" "deploy" {
  name   = "terraform-apply-and-deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}
