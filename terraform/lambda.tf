data "archive_file" "trigger_function_zip" {
  type = "zip"
  source_file = "../transcode/dist/trigger.js"
  output_path = "../transcode/trigger-function.zip"
}

resource "aws_lambda_function" "trigger_function" {
  function_name = "transcode-trigger-function"
  filename = data.archive_file.trigger_function_zip.output_path
  source_code_hash = data.archive_file.trigger_function_zip.output_base64sha256
  handler = "trigger.handler"
  runtime = "nodejs24.x"
  role = aws_iam_role.lambda_exec_role.arn
  timeout = 30

  environment {
    variables = {
      MEDIACONVERT_ENDPOINT = "https://mediaconvert.ap-south-1.amazonaws.com"
      MEDIACONVERT_ROLE_ARN = aws_iam_role.mediaconvert_role.arn
      OUTPUT_BUCKET = aws_s3_bucket.output_bucket.bucket
      DATABASE_URL=var.DATABASE_URL
    }
  }
}

data "archive_file" "on_complete_function_zip" {
  type = "zip"
  source_file = "../transcode/dist/on-complete.js"
  output_path = "../transcode/oncomplete-function.zip"
}

resource "aws_lambda_function" "oncomplete_function" {
  function_name = "transcode-oncomplete-function"
  filename = data.archive_file.on_complete_function_zip.output_path
  source_code_hash = data.archive_file.on_complete_function_zip.output_base64sha256
  handler = "on-complete.handler"
  runtime = "nodejs24.x"
  role = aws_iam_role.lambda_exec_role.arn
  timeout = 30

  environment {
    variables = {
      DATABASE_URL=var.DATABASE_URL
    }
  }
}

resource "aws_s3_bucket_notification" "input_upload_trigger" {
  bucket = aws_s3_bucket.input_bucket.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.trigger_function.arn
    events = [ "s3:ObjectCreated:*" ]
    filter_suffix = ".mp4"
  }
}

resource "aws_lambda_permission" "allow_s3_invoke" {
  statement_id = "AllowS3Invoke"
  action = "lambda:InvokeFunction"
  function_name = aws_lambda_function.trigger_function.function_name
  principal = "s3.amazonaws.com"
  source_arn = aws_s3_bucket.input_bucket.arn
}