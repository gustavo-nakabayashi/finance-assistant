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

resource "vercel_project" "finance-assistant" {
  name      = "finance-assistant"
  framework = "nextjs"
  
  git_repository = {
    type = "github"
    repo = "gustavo-nakabayashi/finance-assistant"
  }

  environment = [
    {
      key    = "CONTA49_EMAIL"
      type = string
      target = ["production", "preview", "development"]
    },
    {
      key    = "CONTA49_PASSWORD"
      type = string
      sensitive = true
      target = ["production", "preview", "development"]
    },
    {
      key    = "CONTA49_FIREBASE_API_KEY"
      type = string
      sensitive = true
      target = ["production", "preview", "development"]
    },
    {
      key    = "CONTA49_ACCOUNT_ID"
      type = string
      sensitive = true
      target = ["production", "preview", "development"]
    },
    {
      key    = "BANCO_INTER_CLIENT_ID"
      type = string
      sensitive = true
      target = ["production", "preview", "development"]
    },
    {
      key    = "BANCO_INTER_CLIENT_SECRET"
      type = string
      sensitive = true
      target = ["production", "preview", "development"]
    },
    {
      key    = "NODE_ENV"
      value  = "production"
      target = ["production"]
    },
    {
      key    = "CRON_SECRET"
      type = string
      sensitive = true
      target = ["production", "preview", "development"]
    },
    # { Neon creates this automatically on vercel
    #   key    = "DATABASE_URL"
    #   value  = ""
    #   target = ["production", "preview", "development"]
    # },
  ]
}

