pipeline {
    agent any

    tools {
        nodejs 'node16'
        jdk 'jdk17'
    }

    environment {
        SCANNER_HOME   = tool 'mysonar'
        DOCKER_IMAGE   = 'swiggy-app'
        DOCKER_TAG     = "${env.BUILD_NUMBER}"
        CONTAINER_NAME = 'Swiggy-app-container'
        CONTAINER_PORT = '3000'
        HOST_PORT      = '5453'
        }

    stages {

        // ─────────────────────────────────────────────
        stage('Checkout') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/Nikhil-5453/Zomato-project.git'
                script {
                    env.GIT_COMMIT  = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
                    env.GIT_BRANCH  = sh(script: 'git rev-parse --abbrev-ref HEAD', returnStdout: true).trim()
                }
                echo "Checked out commit ${env.GIT_COMMIT} on branch ${env.GIT_BRANCH}"
            }
        }

        // ─────────────────────────────────────────────
        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        // ─────────────────────────────────────────────
        stage('Test') {
            steps {
                sh '''
                    CI=true npm run test:ci -- \
                    --reporters=default \
                    --reporters=jest-junit
                '''
            }
            post {
                always {
                    // Publish JUnit results regardless of pass/fail
                    junit allowEmptyResults: true, testResults: 'reports/junit.xml'
                }
            }
        }

        // ─────────────────────────────────────────────
        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('mysonar') {
                    sh """
                         $SCANNER_HOME/bin/sonar-scanner \
                        -Dsonar.projectKey=Zomato-clone \
                        -Dsonar.projectName=Zomato-clone \
                        -Dsonar.projectVersion=1.0 \
                        -Dsonar.sources=src \
                        -Dsonar.tests=src \
                        -Dsonar.test.inclusions=src/**/*.test.js \
                        -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                        -Dsonar.junit.reportPaths=reports/junit.xml \
                        -Dsonar.sourceEncoding=UTF-8
                    """
                }
            }
        }

        // ─────────────────────────────────────────────
        stage('Quality Gate') {
            steps {
                timeout(time: 20, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        // ─────────────────────────────────────────────
        stage('OWASP Dependency Check') {
            steps {
                dependencyCheck(
                    additionalArguments: '''
                    --scan ./
                    --out ./
                    --format XML
                    --format HTML
                    --disableYarnAudit
                    --disableNodeAudit
                    ''',
                    odcInstallation: 'Dp-check',
                    nvdCredentialsId: 'nvd-api-key'
                )
            }
            post {
                always {
                    dependencyCheckPublisher pattern: '**/dependency-check-report.xml'
                }
            }
        }

        // ─────────────────────────────────────────────
        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        // ─────────────────────────────────────────────
        stage('Docker Image Build') {
            steps {
                sh """
                    docker build --no-cache \
                    --label "build_number=${BUILD_NUMBER}" \
                    -t ${DOCKER_IMAGE}:${DOCKER_TAG} \
                    .
                """
                echo "Docker image ${DOCKER_IMAGE}:${DOCKER_TAG} built successfully"
            }
        }

        // ─────────────────────────────────────────────
        stage('Trivy Image Scan') {
            steps {
                sh """
                    trivy image \
                    --format table \
                    --severity HIGH,CRITICAL \
                    --scanners vuln \
                    --output trivyfs.txt \
                    ${DOCKER_IMAGE}:${DOCKER_TAG}
                """
                archiveArtifacts artifacts: 'trivyfs.txt', allowEmptyArchive: true
            }
        }

        // ─────────────────────────────────────────────
        stage('Push Image to Docker Hub') {
            steps {
                script {
                    withDockerRegistry(credentialsId: 'docker-creds') {
                        sh """
                            docker tag  ${DOCKER_IMAGE}:${DOCKER_TAG} nikhil74/${DOCKER_IMAGE}:${DOCKER_TAG}
                            docker push nikhil74/${DOCKER_IMAGE}:${DOCKER_TAG}
                        """
                    }
                }
                echo "Docker image nikhil74/${DOCKER_IMAGE}:${DOCKER_TAG} pushed successfully"
            }
        }

        // ─────────────────────────────────────────────
        stage('Container Deployment') {
            steps {
                script {
                    // Stop and remove old container if it exists
                    sh """
                    docker kill ${CONTAINER_NAME} || true
                    docker rm ${CONTAINER_NAME} || true
                    """

                    echo "Existing container ${CONTAINER_NAME} stopped and removed"

                    // Pull the freshly pushed image from Docker Hub
                    sh "docker pull nikhil74/${DOCKER_IMAGE}:${DOCKER_TAG}"
                    echo "Image nikhil74/${DOCKER_IMAGE}:${DOCKER_TAG} pulled successfully"

                    sh """
                        docker run -d \
                        --name ${CONTAINER_NAME} \
                        --restart unless-stopped \
                        -p ${HOST_PORT}:${CONTAINER_PORT} \
                        nikhil74/${DOCKER_IMAGE}:${DOCKER_TAG}
                    """

                    sh "docker ps | grep ${CONTAINER_NAME}"
                    echo "Container ${CONTAINER_NAME} deployed on port ${HOST_PORT}"
                }
            }
        }

        // ─────────────────────────────────────────────
        stage('Health Check') {
            steps {
                sh '''
                    # Wait for the application to start
                    sleep 10

                    # Check if the application is responding
                    if curl -sf "http://$(curl -s ipinfo.io/ip):${HOST_PORT}"; then
                        echo "Health check passed: Application is responding"
                    else
                        echo "Health check failed: Application is not responding"
                        exit 1
                    fi
                '''
            }
        }
    }

    // ─────────────────────────────────────────────────
    post {
        success {
            echo "Pipeline executed successfully — ${DOCKER_IMAGE}:${DOCKER_TAG} deployed on port ${HOST_PORT}"
            emailext(
                to: '$DEFAULT_RECIPIENTS',
                subject: "SUCCESS: Job '${env.JOB_NAME} [${env.BUILD_NUMBER}]'",
                body: "Pipeline success completed.\nDetails: ${env.BUILD_URL}, Checked out commit ${env.GIT_COMMIT} on branch ${env.GIT_BRANCH}"
            )
        }
        failure {
            echo "Pipeline failed — Build ${env.BUILD_NUMBER} of ${DOCKER_IMAGE}:${DOCKER_TAG} failed to deploy"
            emailext(
                to: '$DEFAULT_RECIPIENTS',
                subject: "FAILURE: Job '${env.JOB_NAME} [${env.BUILD_NUMBER}]'",
                body: "Pipeline success completed.\nDetails: ${env.BUILD_URL}, Checked out commit ${env.GIT_COMMIT} on branch ${env.GIT_BRANCH}"
            )
        }
        always {
        sh '''
        # Get all tags for this image except the current one, then remove them
        docker images nikhil74/${DOCKER_IMAGE} --format '{{.Tag}}' | \
        grep -v '^${DOCKER_TAG}\$' | \
        xargs -I {} docker rmi nikhil74/${DOCKER_IMAGE}:{} || true

        # Remove local build image of current tag (safe — container uses hub image)
        docker rmi ${DOCKER_IMAGE}:${DOCKER_TAG} || true

        # Prune dangling images
        docker image prune -f || true
        '''
        echo "Old Docker images cleaned up (kept current tag: ${DOCKER_TAG})"
        cleanWs()
        }
    }
}