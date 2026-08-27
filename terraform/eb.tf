
resource "aws_cloudwatch_event_rule" "mediaconvert_job_state" {
  name = "mediaconvert-job-state-change"
  event_pattern = jsonencode({
    source      = ["aws.mediaconvert"]
    detail-type = ["MediaConvert Job State Change"]
    detail = {
      status = ["COMPLETE", "ERROR"]
    }
  })
}

resource "aws_cloudwatch_event_target" "notify_on_complete" {
  rule = aws_cloudwatch_event_rule.mediaconvert_job_state.name
  target_id = "notify-on-complete-lambda"
  arn = aws_lambda_function.oncomplete_function.arn
}

resource "aws_lambda_permission" "allow_eventbridge_invoke" {
  statement_id = "AllowEventBridgeInvoke"
  action = "lambda:InvokeFunction"
  function_name = aws_lambda_function.oncomplete_function.function_name
  principal = "events.amazonaws.com"
  source_arn = aws_cloudwatch_event_rule.mediaconvert_job_state.arn
}