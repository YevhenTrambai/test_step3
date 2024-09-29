resource "aws_vpc" "jenkins_vpc" {
  cidr_block = var.vpc_cidr_block

  tags = {
    Name  = "${var.general_tags["Environment"]}-Vpc"
    Owner = "${var.general_tags["Owner"]}"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "jenkins_igw" {
  vpc_id = aws_vpc.jenkins_vpc.id

  tags = {
    Name  = "${var.general_tags["Environment"]}-Igw"
    Owner = "${var.general_tags["Owner"]}"
  }
}

# Elastic IP for NAT Gateway
resource "aws_eip" "jenkins_nat_eip" {
  domain = "vpc"

  tags = {
    Name  = "${var.general_tags["Environment"]}-eip-nat-gw"
    Owner = "${var.general_tags["Owner"]}"
  }
}

# NAT Gateway for private subnets to access the internet
resource "aws_nat_gateway" "jenkins_nat" {
  allocation_id = aws_eip.jenkins_nat_eip.id
  subnet_id     = aws_subnet.public_subnet.id

  tags = {
    Name  = "${var.general_tags["Environment"]}-nat-gw"
    Owner = "${var.general_tags["Owner"]}"
  }
}

# Public Subnet
resource "aws_subnet" "public_subnet" {
  vpc_id            = aws_vpc.jenkins_vpc.id
  cidr_block        = var.public_subnet_cidr_block
  map_public_ip_on_launch = true

  tags = {
    Name  = "${var.general_tags["Environment"]}-Public-Subnet"
    Owner = "${var.general_tags["Owner"]}"
  }
}

# Private Subnet
resource "aws_subnet" "private_subnet" {
  vpc_id            = aws_vpc.jenkins_vpc.id
  cidr_block = var.private_subnet_cidr_block

  tags = {
    Name  = "${var.general_tags["Environment"]}-Private-Subnet"
    Owner = "${var.general_tags["Owner"]}"
  }
}

# Route Table for Public Subnet
resource "aws_route_table" "public_route_table" {
  vpc_id = aws_vpc.jenkins_vpc.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.jenkins_igw.id
  }

  tags = {
    Name  = "${var.general_tags["Environment"]}-Public-Route"
    Owner = "${var.general_tags["Owner"]}"
  }
}

# Associate Public Subnet with Public Route Table
resource "aws_route_table_association" "public_association" {
  subnet_id      = aws_subnet.public_subnet.id
  route_table_id = aws_route_table.public_route_table.id
}

# Route Table for Private Subnet (linked to NAT Gateway)
resource "aws_route_table" "private_route_table" {
  vpc_id = aws_vpc.jenkins_vpc.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.jenkins_nat.id
  }

  tags = {
    Name  = "${var.general_tags["Environment"]}-private_route_table"
    Owner = "${var.general_tags["Owner"]}"
  }
}

# Associate Private Subnet with Private Route Table
resource "aws_route_table_association" "private_association" {
  subnet_id      = aws_subnet.private_subnet.id
  route_table_id = aws_route_table.private_route_table.id
}