terraform {
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 0.4.0"
    }
  }
}

provider "vercel" {
  api_token = var.vercel_api_token
}

variable "vercel_api_token" {
  description = "Vercel API token"
  type        = string
  sensitive   = true
}

# Vercel Project
resource "vercel_project" "tax_payment_automator" {
  name      = "tax-payment-automator"
  framework = "nextjs"
  
  git_repository = {
    type = "github"
    repo = "gustavo-nakabayashi/payment-automator"
  }

  environment = [
    {
      key    = "CONTA49_EMAIL"
      value  = ""  # Will be set via Vercel UI or separate deployment
      target = ["production", "preview", "development"]
    },
    {
      key    = "CONTA49_PASSWORD"
      value  = ""  # Will be set via Vercel UI or separate deployment
      target = ["production", "preview", "development"]
    },
    {
      key    = "CONTA49_FIREBASE_API_KEY"
      value  = ""  # Will be set via Vercel UI or separate deployment
      target = ["production", "preview", "development"]
    },
    {
      key    = "CONTA49_ACCOUNT_ID"
      value  = ""  # Will be set via Vercel UI or separate deployment
      target = ["production", "preview", "development"]
    },
    {
      key    = "BANCO_INTER_CLIENT_ID"
      value  = ""  # Will be set via Vercel UI or separate deployment
      target = ["production", "preview", "development"]
    },
    {
      key    = "BANCO_INTER_CLIENT_SECRET"
      value  = ""  # Will be set via Vercel UI or separate deployment
      target = ["production", "preview", "development"]
    },
    {
      key    = "POLLING_INTERVAL"
      value  = "60"
      target = ["production", "preview", "development"]
    },
    {
      key    = "NODE_ENV"
      value  = "production"
      target = ["production"]
    },
    {
      key    = "POSTGRES_URL"
      value  = ""  # Will be set via Vercel UI when connecting the database
      target = ["production", "preview", "development"]
    },
    {
      key    = "POSTGRES_PRISMA_URL"
      value  = ""  # Will be set via Vercel UI when connecting the database
      target = ["production", "preview", "development"]
    },
    {
      key    = "POSTGRES_URL_NON_POOLING"
      value  = ""  # Will be set via Vercel UI when connecting the database
      target = ["production", "preview", "development"]
    },
    {
      key    = "POSTGRES_USER"
      value  = ""  # Will be set via Vercel UI when connecting the database
      target = ["production", "preview", "development"]
    },
    {
      key    = "POSTGRES_PASSWORD"
      value  = ""  # Will be set via Vercel UI when connecting the database
      target = ["production", "preview", "development"]
    },
    {
      key    = "POSTGRES_HOST"
      value  = ""  # Will be set via Vercel UI when connecting the database
      target = ["production", "preview", "development"]
    }
  ]
}

# Note: Vercel Postgres is provisioned through the Vercel dashboard
# and connected to the project via environment variables
# The terraform provider doesn't currently support direct database provisioning

# Note: Vercel Cron Jobs are configured in vercel.json
# The terraform provider doesn't currently support direct cron job configuration

