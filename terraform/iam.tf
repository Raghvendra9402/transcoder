data "aws_iam_policy_document" "mediaconvert_role_assume_policy" {
  statement {
    effect = "Allow"
    principals {
      type = "Service"
      identifiers = [ "mediaconvert.amazonaws.com" ]
    }
    actions = [ "sts:AssumeRole" ]
  }
}

resource "aws_iam_role" "mediaconvert_role" {
  name = "mediaconvert-role"
    assume_role_policy = data.aws_iam_policy_document.mediaconvert_role_assume_policy.json
}

data "aws_iam_policy_document" "mediaconvert_role_policy_doc" {
  statement {
    effect = "Allow"
    actions = [ "s3:GetObject", "s3:PutObject", "s3:ListBucket" ]
    resources = [ 
        "${aws_s3_bucket.input_bucket.arn}/*",
        "${aws_s3_bucket.output_bucket.arn}/*"
     ]
  }
}

resource "aws_iam_role_policy" "mediaconvert_role_policy" {
  name   = "mediaconvert-policy"
  role = aws_iam_role.mediaconvert_role.id
  policy = data.aws_iam_policy_document.mediaconvert_role_policy_doc.json
}

data "aws_iam_policy_document" "lambda_exec" {
  statement {
    effect = "Allow"
    principals {
      type = "Service"
      identifiers = [ "lambda.amazonaws.com" ]
    }
    actions = [ "sts:AssumeRole" ]
  }
}

resource "aws_iam_role" "lambda_exec_role" {
  name = "video-transcode-lambda"

  assume_role_policy = data.aws_iam_policy_document.lambda_exec.json
}

resource "aws_iam_role_policy_attachment" "lambda_exec" {
  role = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_mediaconvert_access" {
  name = "lambda-mediaconvert-trigger"
  role = aws_iam_role.lambda_exec_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [ "mediaconvert:CreateJob", "mediaconvert:GetJob", "mediaconvert:DescribeEndpoints" ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = "iam:PassRole"
        Resource = aws_iam_role.mediaconvert_role.arn
      },
      {
        Effect = "Allow"
        Action = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.input_bucket.arn}/*"
      }
    ]
  })
}