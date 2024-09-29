provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "S3_bucket_tfstate" {
  bucket = "yevhentr-terraform-state-bucket"

tags = {
    Name        = "My_tfstate_bucket"
  }
}

resource "aws_s3_bucket_versioning" "aws_s3_bucket_versioning" {
  bucket = aws_s3_bucket.S3_bucket_tfstate.id
  versioning_configuration {
    status = "Enabled"
    }
}