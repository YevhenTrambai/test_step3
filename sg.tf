# Create Security Group for HTTPS and HTTP access
resource "aws_security_group" "jenkins_http_https_sg" {
    name = "Allow-http-https"
    description = "Allow SSH,HTTP,HTTPS inbound traffic"
    vpc_id = aws_vpc.jenkins_vpc.id

  dynamic "ingress" {
    for_each = [80, 443]
    content {       
    from_port   = ingress.value
    to_port     = ingress.value
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Create Security Group for SSH access
resource "aws_security_group" "jenkins_ssh_sg" {
  name        = "Allow-ssh"
  description = "Allow SSH inbound traffic and all outbound traffic"
  vpc_id      = aws_vpc.jenkins_vpc.id  

  ingress {
    from_port        = 22
    to_port          = 22
    protocol         = "tcp"
    cidr_blocks      = ["0.0.0.0/0"]
  }

egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
  } 
}

# Create Security Group for connect Jenkins-worker
resource "aws_security_group" "jenkins_worker_port" {
  name        = "Allow-port-50000"
  description = "Allow port 50000 to connect jenkins-worker"
  vpc_id      = aws_vpc.jenkins_vpc.id  

  ingress {
    from_port        = 50000
    to_port          = 50000
    protocol         = "tcp"
    cidr_blocks      = ["0.0.0.0/0"]
  }

egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
  } 
}