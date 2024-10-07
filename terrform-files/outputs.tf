output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.jenkins_vpc.id
}

output "public_subnet_id" {
  description = "The ID of the public subnet"
  value       = aws_subnet.public_subnet.id
}

output "private_subnet_id" {
  description = "The ID of the private subnet"
  value       = aws_subnet.private_subnet.id
}

output "jenkins_master_public_ip" {
  description = "Public IP of the Jenkins Master instance"
  value       = aws_instance.jenkins_master.public_ip
}

output "private_key" {
  description = "Private SSH key"
  value       = tls_private_key.ssh_key.private_key_pem
  sensitive   = true
}

output "public_key" {
  description = "Public SSH key"
  value       = tls_private_key.ssh_key.public_key_openssh
  sensitive   = true
}