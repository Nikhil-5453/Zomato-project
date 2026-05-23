Title: Zomato-App a nodejs application.
Description: An automated pipeline to code-build-deploy.

Tools integrated and pipeline flow:
  git -> npm (Install-test) -> SonarQube Analysis -> Quality Gate -> Owasp dependency-check -> npm build(optional) -> Docker Image build -> Trivy -> Docker push -> Docker container deployment -> Health check -> post actions.


Required Installations:
On Instance:
 - git
 - Jenkins(8080)
 - Trivy
 - Docker
 - SonarQube(9000) via Docker container

Project Implementation:
Step 1: After installing Jenkins, Go to plugins and install following:
        - Docker pipeline
        - nodejs
        - SonarQube Scanner
        - Owasp Dependency check
        - Eclipse Temurin installer
        - Blue Ocean (Optional)

Step 2: Configure Jenkins Tools with following:
        - JDK Installation:
          - Name: "jdk17"
          - Select install automatically from 'adoptium.net', here required java version is 'jdk-17.0.8.1+1'
          - java is for SonarQube installation.
         
        - SonarQube Scanner Installation:
          - Name: "mysonar"
          - Default to latest version
 
        - Nodejs Installation:
          - Name: "node16"
          - Select version of nodejs, here required version is 'Nodejs 16.20.2'
            - This is nearby matching version to application developed version(16.2.0)

        - Dependency-check Installation:
          - Name: "Dp-check"
          - Default to latest version or select 'dependency-check 6.5.1'
          - Select install automatically from 'GitHub.com'
          - For latest version, need to give 'NVD-api key' when invoke the dependency-check through pipeline syntax as (secret text) kind.

Step 3: Downlaod and setup Trivy:
        - Download via link:
          '''
          wget https://github.com/aquasecurity/trivy/releases/download/v0.70.0/trivy_0.70.0_Linux-64bit.tar.gz
          '''
        - unzip and move to user executation path
          '''
          tar -zvxf trivy_0.70.0_Linux-64bit.tar.gz && mv trivy /usr/local/bin/
          '''
        - Add export path in '.bashrc' file
          '''
          sed -i '$ a\export PATH=$PATH:/usr/local/bin/' ~/.bashrc && source ~/.bashrc
          '''

Step 4: Download and setup SonaQube:
        - Start a Docker container for SonarQube
        '''
        docker run -d --name sonar-cont -p <host-ip>:9000 sonarqube:latest
        '''
      
        - Access SonarQube and setup a dummy project.

        - Generate a Global access token for Jenkins:
          - SonarQube -> Administration -> Security -> new token

        - Configure the token in Jenkins global credentials for SonarQube scanner installation as (Secret text) kind.
          - Go to Jenkins System configuration -> Add credentials -> select secret text -> paste it.

        - Pipeline arguments for SonarQube Scanner:
          - Use pipeline syntax with arguments and invoke syntax.
          '''
          dependencyCheck additionalArguments: '--scan ./ --disableYarnAudit --disableNodeAudit', odcInstallation: 'DP-check'
          dependencyCheckPublisher pattern: '**/dependency-check-report.xml'
          '''
          - Or ref Jenkinsfile.

Step 5: Create a pipeline and build (Gitscm) optional.
        - Pipeline build and deploy application.

Step 6: Configure a mail notification.
        - Go to Gmail Account -> Enable 2-step verification, generate APP password (16 letter).
        - configure in Jenkins credentials as (username and password) kind.

        - Go to Jenkins system configuration -> Extended Email notification
          SMTP server                 : 'smtp.gmail.com'
          SMTP Port                   : '465'
          Default user e-mail suffix  : '@gmail.com'
          Default Recipients          : 'recipeient@gmail.com'

        - give Gmail sender and recipient details, select protocol of SSL(465) or TLS(587).
        - give default subject and message.

Step 7: Hence, build success "Application Deployed".


===========================================================================

Common Issues & Resolutions:

=> SonarQube Quality Gate taking too long 
   - Low server resources/Elasticsearch lag -> Set `vm.max_map_count=524288` on host, use PostgreSQL DB.
=> OWASP `--nvdApiKey` unrecognized
   - Plugin version too old to Use `dependency-check 6.5.1` or upgrade plugin.
=> Email configuration error
   - sending to `null`, Wrong recipient format or double quotes on "$DEFAULT_RECIPIENTS"
   - Use single quotes: '$DEFAULT_RECIPIENTS'
=> Email "Address not found" bounce
   - From address mismatch with SMTP account.
   - Set System Admin email = sender Gmail account.
=> Woerpsce clean 'docker rmi' conflict on running container
   - Container holds image reference so use '--force' flag: 'docker rmi --force'
   - this removes image or ref to container, container runs on docker hub image.
=> Pipeline FAILURE despite successful deploy
   - Earlier stage (e.g. OWASP) failed, marking build failed due to Fix failing stage or use `catchError` to continue.
=> GitHub webhook 403 error
   - Jenkins CSRF protection, Disable "Prevent Cross Site Request Forgery" in security config







