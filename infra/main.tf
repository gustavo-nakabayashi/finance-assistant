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

