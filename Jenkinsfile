Dpipeline {
    agent { label 'jenkins_worker' }

    stages {
        stage('Pull Code') {
            steps {
                checkout([$class: 'GitSCM', branches: [[name: 'main']], userRemoteConfigs: [[url: 'git@github.com:YevhenTrambai/test-step2.git', credentialsId: 'GIT_CRED']]])
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
                
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    docker.build('yevhent/test_step3')
                }
            }
        }

        stage('Run Docker Container') {
            steps {
                script {
                    def app = docker.image('yevhent/test_step3')
                    app.inside('--entrypoint="" -v /home/ec2-user/opt/jenkins/workspace/Step2-test-pipeline:/app -w /app') {
                        sh 'npm test'
                    }
                }
            }
        }

        stage('Push to Docker Hub') {
            when {
                expression {
                    currentBuild.result == null || currentBuild.result == 'SUCCESS'
                }
            }
            steps {
                script {
                    docker.withRegistry('https://index.docker.io/v1/', 'docker_log_pass') {
                        def customImage = docker.image('yevhent/test_step3')
                        customImage.push('latest')
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'Build and tests succeeded'
        }
        failure {
            echo 'Tests failed'
        }
    }
}

