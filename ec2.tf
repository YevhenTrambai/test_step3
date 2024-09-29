# Get latest Ubuntu AMI
data "aws_ami" "ubuntu" {
  most_recent = true

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  owners = ["099720109477"]
}

# Resource: EC2 Key Pair
resource "tls_private_key" "ssh_key" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

# Create EC2 Key Pair
resource "aws_key_pair" "jenkins_key" {
  key_name   = "jenkins_ssh_key"
  public_key = tls_private_key.ssh_key.public_key_openssh
}

# Launch EC2 Jenkins Master in Public Subnet
resource "aws_instance" "jenkins_master" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type_jk_master
  associate_public_ip_address = true
  subnet_id                   = aws_subnet.public_subnet.id
  security_groups             = [aws_security_group.jenkins_http_https_sg.id, aws_security_group.jenkins_ssh_sg.id, aws_security_group.jenkins_worker_port]
  key_name                    = aws_key_pair.jenkins_key.key_name

  user_data = <<-EOF
              #!/bin/bash
              echo "${aws_key_pair.jenkins_key.public_key}" > /home/ubuntu/.ssh/authorized_keys
              sudo apt update
              sudo apt install -y python3 ansible
              EOF

  provisioner "local-exec" {
    command = "echo '[jenkins_master]${self.public_ip} ansible_user=ubuntu' >> inventory"
  }

  tags = {
    Name = "${var.general_tags["Environment"]}-Master-jenkins"
    Owner = "${var.general_tags["Owner"]}"
  }
}

# Request Spot Instance for Jenkins Worker in Private Subnet
resource "aws_spot_instance_request" "jenkins_worker" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type_jk_worker
  subnet_id                   = aws_subnet.private_subnet.id
  security_groups             = [aws_security_group.jenkins_ssh_sg.id]
  key_name                    = aws_key_pair.jenkins_key.key_name

  user_data = <<-EOF
              #!/bin/bash
              echo "${aws_key_pair.jenkins_key.public_key}" > /home/ubuntu/.ssh/authorized_keys
              sudo apt update
              sudo apt install -y openjdk-11-jdk
              EOF

  tags = {
    Name = "${var.general_tags["Environment"]}-jenkins-Worker"
    Owner = "${var.general_tags["Owner"]}"
  }
}