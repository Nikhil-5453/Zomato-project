pipeline{
    agent any
    tools{
        nodejs 'node16'
        jdk 'jdk17'
    }
    environment{
        SCANNER_HOME= tool 'mysonar'
    }
    stages{
        stage("clean"){
            steps{
                cleanWs()
            }
        }
        stage("checkout"){
            steps{
                git branch: 'main',
                    url: 'https://github.com/Nikhil-5453/Zomato-project.git'
            }
        }
        stage("Install dependency"){
            steps{
                sh 'npm install'
            }
        }
        stage("test"){
            steps{
                sh '''
                CI=true npm run test:ci -- \
                --reporters=default \
                --reporters=jest-junit
                '''
            }
        }
        stage("SonarQube Analysis"){
            steps{
                withSonarQubeEnv('mysonar'){
                    sh '''
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
                    '''
                }
            }
        }
        stage('Quality Gate'){
            steps{
                timeout(time: 20, unit: 'MINUTES'){
                    waitForQualityGate abortPipeline: true
                }
            }
        }
       stage('OWASP'){
            steps{
                dependencyCheck additionalArguments: '''
                --scan ./
                --format XML
                --format HTML
                --disableYarnAudit
                --disableNodeAudit
                ''', odcInstallation: 'Dp-check', nvdCredentialsId: 'nvd-api'
            }
            post{
                always{
                    dependencyCheckPublisher(
                        pattern: '**/dependency-check-report.xml')
                }
            }
        }
        stage("Build"){
            steps{
                sh 'npm run build'
            }
        }
        stage("Docker-Image"){
            steps{
                sh 'docker build -t image1 .'
            }
        }
        stage("trivy"){
            steps{
                sh 'trivy fs . >> trivyfs.txt'
            }
        }
        stage("Imagescan"){
            steps{
                sh 'trivy image image1'
            }
        }
        stage("image push"){
            steps{
                script{
                    withDockerRegistry(credentialsId: 'docker-creds') {
                        sh 'docker tag image1 nikhil74/zomato-app:v1'
                        sh 'docker push nikhil74/zomato-app:v1'
                    }
                }
            }
        }
        stage("Deployment"){
            steps{
                sh 'docker run -d --name Zomato-app -p 5453:3000 nikhil74/zomato-app:v1'
            }
        }
    }
    post{
        success{
            echo 'Pipleine executed successfully'
        }
        failure{
            echo "Pipline failed"
        }
    }
}