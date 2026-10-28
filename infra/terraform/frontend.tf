# ---------------------------------------------------------------- bucket S3
# Privado: solo CloudFront puede leerlo (Origin Access Control).

resource "aws_s3_bucket" "web" {
  bucket = "${var.project_name}-web-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket                  = aws_s3_bucket.web.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "web" {
  bucket = aws_s3_bucket.web.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "web" {
  bucket = aws_s3_bucket.web.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

data "aws_iam_policy_document" "web_bucket" {
  statement {
    sid       = "AllowCloudFrontRead"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.web.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    # Solo esta distribución (evita el "confused deputy").
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.web.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "web" {
  bucket     = aws_s3_bucket.web.id
  policy     = data.aws_iam_policy_document.web_bucket.json
  depends_on = [aws_s3_bucket_public_access_block.web]
}

# ------------------------------------------------------- certificado (ACM)
# Solo con dominio; sin él, CloudFront usa su certificado de *.cloudfront.net.

resource "aws_acm_certificate" "web" {
  count                     = local.use_domain ? 1 : 0
  provider                  = aws.us_east_1
  domain_name               = local.site_domain
  subject_alternative_names = [local.www_domain]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "web_cert_validation" {
  # Claves fijas (los dominios): las opciones de validación solo se conocen tras crear el certificado.
  for_each = local.use_domain ? toset([local.site_domain, local.www_domain]) : toset([])

  zone_id         = local.zone_id
  name            = local.cert_validation[each.key].resource_record_name
  type            = local.cert_validation[each.key].resource_record_type
  ttl             = 300
  records         = [local.cert_validation[each.key].resource_record_value]
  allow_overwrite = true
}

locals {
  cert_validation = {
    for o in flatten(aws_acm_certificate.web[*].domain_validation_options) : o.domain_name => o
  }
}

resource "aws_acm_certificate_validation" "web" {
  count                   = local.use_domain ? 1 : 0
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.web[0].arn
  validation_record_fqdns = [for r in aws_route53_record.web_cert_validation : r.fqdn]
}

# ---------------------------------------------------------------- CloudFront

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${var.project_name}-web"
  description                       = "Acceso de CloudFront al bucket del frontend"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Rutas de la SPA (/rally-de-letras/sala/ABCDE) → index.html, y www → dominio raíz.
resource "aws_cloudfront_function" "spa" {
  name    = "${var.project_name}-spa"
  runtime = "cloudfront-js-2.0"
  comment = "Redirige www al dominio raíz y sirve index.html en las rutas de la SPA"
  publish = true
  code    = templatefile("${path.module}/templates/spa-router.js.tftpl", { site_domain = local.site_domain })
}

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_response_headers_policy" "security" {
  name = "Managed-SecurityHeadersPolicy"
}

# Para la API (solo sin dominio): nada en caché y todo lo del navegador hacia Node
# (query string de Socket.IO, cabeceras de WebSocket, Origin para CORS…).
data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  comment             = "${var.project_name} frontend"
  aliases             = local.use_domain ? [local.site_domain, local.www_domain] : []
  default_root_object = "index.html"
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  price_class         = var.cloudfront_price_class

  origin {
    origin_id                = "s3-web"
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  # Sin dominio, la API va por esta misma distribución hasta Caddy (HTTP, puerto 80) en la instancia.
  # El tramo CloudFront → instancia no va cifrado; con dominio, el navegador habla HTTPS
  # directamente con api.<dominio> y este origen no existe.
  dynamic "origin" {
    for_each = local.use_domain ? [] : [local.api_origin_domain]
    content {
      origin_id   = "api"
      domain_name = origin.value

      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "http-only"
        origin_ssl_protocols   = ["TLSv1.2"]
        # El sondeo largo de Socket.IO retiene cada petición hasta ~25 s.
        origin_read_timeout = 60
      }
    }
  }

  dynamic "ordered_cache_behavior" {
    for_each = local.use_domain ? [] : ["/socket.io/*", "/health"]
    content {
      path_pattern             = ordered_cache_behavior.value
      target_origin_id         = "api"
      viewer_protocol_policy   = "https-only"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      compress                 = false
      cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
      origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
    }
  }

  default_cache_behavior {
    target_origin_id           = "s3-web"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.optimized.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = !local.use_domain
    acm_certificate_arn            = local.use_domain ? aws_acm_certificate_validation.web[0].certificate_arn : null
    ssl_support_method             = local.use_domain ? "sni-only" : null
    # Con el certificado de *.cloudfront.net, CloudFront fija la versión mínima por su cuenta.
    minimum_protocol_version = local.use_domain ? "TLSv1.2_2021" : "TLSv1"
  }
}
