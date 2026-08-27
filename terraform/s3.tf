resource "aws_s3_bucket" "input_bucket" {
  bucket = "streaming-input-bucket-tf"
}

resource "aws_s3_bucket" "output_bucket" {
  bucket = "streaming-output-bucket-tf"
}

resource "aws_s3_bucket_cors_configuration" "bucket_cors" {
  bucket = aws_s3_bucket.input_bucket.id
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST"]
    allowed_origins = ["*"]
  }
}