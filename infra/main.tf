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
      value  = ""
      target = ["production", "preview", "development"]
    },
    {
      key    = "CONTA49_PASSWORD"
      value  = ""
      target = ["production", "preview", "development"]
    },
    {
      key    = "CONTA49_FIREBASE_API_KEY"
      value  = ""
      target = ["production", "preview", "development"]
    },
    {
      key    = "CONTA49_ACCOUNT_ID"
      value  = ""
      target = ["production", "preview", "development"]
    },
    {
      key    = "BANCO_INTER_CLIENT_ID"
      value  = ""
      target = ["production", "preview", "development"]
    },
    {
      key    = "BANCO_INTER_CLIENT_SECRET"
      value  = ""
      target = ["production", "preview", "development"]
    },
    {
      key    = "NODE_ENV"
      value  = "production"
      target = ["production"]
    },
    # { Neon creates this automatically on vercel
    #   key    = "DATABASE_URL"
    #   value  = ""
    #   target = ["production", "preview", "development"]
    # },
  ]
}

