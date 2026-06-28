# Dev environment defaults
# Override via -var or terraform.tfvars in CI

rds_instance_class        = "db.t4g.micro"
lambda_log_retention_days = 14
enable_monitoring         = true
