variable "vpc_cidr_block" {
    description = "CIDR block for the VPC"
    type        = string
    default = "10.0.0.0/16" 
}

variable "private_subnet_cidr_block" {
    description = "CIDR block for the private subnet"
    type        = string
    default = "10.0.1.0/24" 
}

variable "public_subnet_cidr_block" {
    description = "CIDR block for the public subnet"
    type        = string
    default = "10.0.2.0/24" 
}

variable "general_tags" {
  description = "General tags to be applied to all resources"
  type = map(any)
  default = {
    Environment = "Step3"
    Owner       = "Yevhen Trambai"
  }
}

variable "instance_type_jk_master" {
  description = "Instance type"
  type        = string
  default = "t2.micro"
}

variable "instance_type_jk_worker" {
  description = "Instance type"
  type        = string
  default = "t2.micro"
}