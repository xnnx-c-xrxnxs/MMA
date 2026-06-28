# ─── Webapp ECS Module ───────────────────────────────────────────────────────
# Creates ECS Cluster + Fargate Service + ALB + Task Definition for Next.js.
# Single instance — not called via for_each (one webapp per environment).

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.21"
    }
  }
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

locals {
  name = "${var.project_name}-${var.environment}-webapp"
  # ALB name: 32 chars max. Target group name: 32 chars max.
  # Truncate and strip trailing hyphens to avoid AWS validation errors.
  alb_name = replace(substr("${var.project_name}-${var.environment}-alb", 0, 32), "/-+$/", "")
  tg_name  = replace(substr("${var.project_name}-${var.environment}-tg", 0, 32), "/-+$/", "")
}

# ─── ECS Cluster ────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "this" {
  name = "${var.project_name}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = var.enable_container_insights ? "enabled" : "disabled"
  }

  tags = var.tags
}

# ─── CloudWatch Log Group ───────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "webapp" {
  name              = "/ecs/${local.name}"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# ─── IAM — Task Execution Role (pull image, write logs) ─────────────────────

resource "aws_iam_role" "task_execution" {
  name = "${local.name}-task-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "task_execution" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ─── IAM — Task Role (app runtime permissions, if needed) ───────────────────

resource "aws_iam_role" "task" {
  name = "${local.name}-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# ─── ALB ────────────────────────────────────────────────────────────────────

resource "aws_lb" "this" {
  name               = local.alb_name
  internal           = false
  load_balancer_type = "application"
  security_groups    = var.alb_security_group_ids
  subnets            = var.public_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-alb"
  })
}

resource "aws_lb_target_group" "webapp" {
  name        = local.tg_name
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = var.health_check_path
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 10
    interval            = 30
    matcher             = "200"
  }

  tags = var.tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.webapp.arn
  }

  tags = var.tags
}

# ─── Task Definition ────────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "webapp" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([
    {
      name      = "webapp"
      image     = var.container_image
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        for k, v in var.environment_variables : {
          name  = k
          value = v
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.webapp.name
          "awslogs-region"        = data.aws_region.current.id
          "awslogs-stream-prefix" = "webapp"
        }
      }
    }
  ])

  tags = var.tags
}

# ─── ECS Service ────────────────────────────────────────────────────────────

resource "aws_ecs_service" "webapp" {
  name            = local.name
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.webapp.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = var.ecs_security_group_ids
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.webapp.arn
    container_name   = "webapp"
    container_port   = var.container_port
  }

  depends_on = [aws_lb_listener.http]

  tags = var.tags

  lifecycle {
    ignore_changes = [desired_count] # Allow auto-scaling to manage
  }
}

# ─── Auto Scaling ───────────────────────────────────────────────────────────

resource "aws_appautoscaling_target" "webapp" {
  count              = var.enable_autoscaling ? 1 : 0
  max_capacity       = var.max_count
  min_capacity       = var.desired_count
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.webapp.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "webapp_cpu" {
  count              = var.enable_autoscaling ? 1 : 0
  name               = "${local.name}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.webapp[0].resource_id
  scalable_dimension = aws_appautoscaling_target.webapp[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.webapp[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
