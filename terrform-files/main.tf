provider "aws" {
 region = "us-east-1"
}

terraform {
  backend "s3" {
    bucket = "yevhentr-terraform-state-bucket"
    key    = "yevhentr/terraform.tfstate"
    region = "us-east-1"
  }
}