# Zomato-App — Node.js Application
### Automated CI/CD Pipeline: Code → Build → Deploy

---

## Project Overview

| Field | Details |
|---|---|
| **Application** | Zomato Clone (React/Node.js) |
| **Pipeline Type** | Declarative Jenkins Pipeline |
| **Deployment** | Docker Container on EC2 |
| **Code Repository** | GitHub (SCM) |
| **Objective** | Fully automated pipeline from code push to container deployment with security scanning and notifications |

---

## Pipeline Flow

```
GitHub Push
    │
    ▼
┌─────────────────┐
│   Git Checkout  │  Clone repo from GitHub
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ npm Install     │  Install project dependencies
│ npm Test        │  Run unit tests + coverage report
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SonarQube       │  Static code analysis
│ Analysis        │  (bugs, code smells, coverage)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Quality Gate    │  Pass/Fail based on SonarQube rules
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ OWASP           │  Dependency vulnerability check
│ Dependency Check│  (CVE scan on npm packages)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ npm Build       │  Create production build (optional)
│ (Optional)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Docker Image    │  Build Docker image from Dockerfile
│ Build           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Trivy Scan      │  Scan Docker image for HIGH/CRITICAL CVEs
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Docker Push     │  Push image to Docker Hub
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Container       │  Stop old container, deploy new one
│ Deployment      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Health Check    │  curl to verify app is responding
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Post Actions    │  Email notification + Cleanup + Workspace wipe
└─────────────────┘
```

---

## Infrastructure Requirements

### EC2 Instance — Required Installations

| Tool | Purpose | Port |
|---|---|---|
| **Git** | Source code checkout | — |
| **Jenkins** | CI/CD orchestration | `8080` |
| **Docker** | Container build & deployment | — |
| **Trivy** | Docker image vulnerability scanner | — |
| **SonarQube** | Static code analysis (via Docker) | `9000` |

---

## Step-by-Step Setup Guide

---

### Step 1 — Jenkins Plugin Installation

Navigate to: **Jenkins → Manage Jenkins → Plugins → Available**

Install the following plugins:

| Plugin | Purpose |
|---|---|
| **Docker Pipeline** | Run Docker commands inside pipeline |
| **NodeJS** | npm/node tool support in pipeline |
| **SonarQube Scanner** | Integrate SonarQube analysis |
| **OWASP Dependency-Check** | CVE scanning for dependencies |
| **Eclipse Temurin Installer** | Auto-install JDK for SonarQube |
| **Email Extension Plugin** | Rich email notifications |
| **GitHub Integration Plugin** | GitHub webhook trigger support |
| **Blue Ocean** *(Optional)* | Modern pipeline visualization UI |

---

### Step 2 — Jenkins Tools Configuration

Navigate to: **Jenkins → Manage Jenkins → Tools**

#### JDK Installation
```
Name:                    jdk17
Install automatically:   ✅ Yes
Source:                  adoptium.net
Version:                 jdk-17.0.8.1+1
Note:                    Required by SonarQube Scanner
```

#### SonarQube Scanner Installation
```
Name:                    mysonar
Install automatically:   ✅ Yes
Version:                 Latest
```

#### Node.js Installation
```
Name:                    node16
Install automatically:   ✅ Yes
Version:                 NodeJS 16.20.2
Note:                    Closest stable version to app's dev version (16.2.0)
```

#### OWASP Dependency-Check Installation
```
Name:                    DP-check
Install automatically:   ✅ Yes
Source:                  github.com
Version:                 dependency-check 6.5.1  (stable, no NVD API key required)
                         OR latest version       (requires NVD API key as secret text)
```

> **Note on NVD API Key:** If using the latest version of Dependency-Check, an NVD API key is required.  
> Generate one at [nvd.nist.gov/developers/request-an-api-key](https://nvd.nist.gov/developers/request-an-api-key)  
> Add it in Jenkins as a **Secret Text** credential and pass it via `--nvdApiKey` argument.

---

### Step 3 — Trivy Installation (on EC2 Instance)

Run the following commands on your EC2 instance:

```bash
# Download Trivy binary
wget https://github.com/aquasecurity/trivy/releases/download/v0.70.0/trivy_0.70.0_Linux-64bit.tar.gz

# Extract and move to system PATH
tar -zvxf trivy_0.70.0_Linux-64bit.tar.gz && mv trivy /usr/local/bin/

# Add to PATH permanently
sed -i '$ a\export PATH=$PATH:/usr/local/bin/' ~/.bashrc && source ~/.bashrc

# Verify installation
trivy --version
```

---

### Step 4 — SonarQube Setup (via Docker)

#### Start SonarQube Container

```bash
docker run -d \
  --name sonar-cont \
  -p 9000:9000 \
  sonarqube:lts-community
```

> **Recommended:** Use `sonarqube:lts-community` instead of `sonarqube:latest` for stability.

#### Required System Settings (on EC2 host)

```bash
# Required by SonarQube's internal Elasticsearch
sudo sysctl -w vm.max_map_count=524288
sudo sysctl -w fs.file-max=131072

# Make permanent
echo "vm.max_map_count=524288" | sudo tee -a /etc/sysctl.conf
echo "fs.file-max=131072" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

#### SonarQube Initial Setup

1. Access SonarQube at `http://<EC2-IP>:9000`
2. Default credentials: `admin / admin` (change on first login)
3. Create a new project manually (or use auto-detection)
4. Generate a **Global Access Token**:
   - **Administration → Security → Users → Tokens → Generate**

#### Add SonarQube Token to Jenkins

- **Jenkins → Manage Jenkins → Credentials → Global → Add Credentials**

```
Kind:         Secret text
Secret:       <paste SonarQube token>
ID:           sonar-token
Description:  SonarQube Global Access Token
```

#### Configure SonarQube Server in Jenkins

- **Jenkins → Manage Jenkins → System → SonarQube Servers**

```
Name:                    mysonar
Server URL:              http://<EC2-IP>:9000
Server authentication:   sonar-token   ← credential ID created above
```

---

### Step 5 — Pipeline Creation & Jenkinsfile

Create a Jenkins Pipeline job and point it to your GitHub repository containing the `Jenkinsfile`.

#### Key Pipeline Arguments Reference

```groovy
// SonarQube Analysis
withSonarQubeEnv('mysonar') {
    sh """
        sonar-scanner \
        -Dsonar.projectKey=Zomato-clone \
        -Dsonar.projectName=Zomato-clone \
        -Dsonar.sources=src \
        -Dsonar.tests=src \
        -Dsonar.test.inclusions=src/**/*.test.js \
        -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
    """
}

// Quality Gate
timeout(time: 20, unit: 'MINUTES') {
    waitForQualityGate abortPipeline: true
}

// OWASP Dependency Check (stable version — no API key)
dependencyCheck additionalArguments: '''
    --scan ./
    --disableYarnAudit
    --disableNodeAudit
    --format XML
    --format HTML
    --out reports/
''', odcInstallation: 'DP-check'

dependencyCheckPublisher pattern: '**/dependency-check-report.xml'

// Trivy Image Scan
sh """
    trivy image \
    --format table \
    --severity HIGH,CRITICAL \
    --scanners vuln \
    --output trivyfs.txt \
    ${DOCKER_IMAGE}:${DOCKER_TAG}
"""
```

---

### Step 6 — Email Notification Setup

#### Gmail App Password

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. **Security → 2-Step Verification → App Passwords**
3. Generate a 16-character App Password for "Mail"

#### Add Gmail Credentials to Jenkins

**Jenkins → Manage Jenkins → Credentials → Global → Add Credentials**

```
Kind:         Username with password
Username:     sender@gmail.com
Password:     <16-character App Password>
ID:           gmail-credentials
```

#### Configure Extended Email in Jenkins

**Jenkins → Manage Jenkins → System → Extended E-mail Notification**

```
SMTP Server:                smtp.gmail.com
SMTP Port:                  465
Credentials:                gmail-credentials
Use SSL:                    ✅ Yes
Default user e-mail suffix: @gmail.com
Default Recipients:         recipient@gmail.com
Reply-To Address:           sender@gmail.com
```

**Jenkins → Manage Jenkins → System → Jenkins Location**

```
System Admin e-mail address:   sender@gmail.com
```

#### Jenkinsfile Email Block

```groovy
post {
    success {
        emailext (
            to: 'recipient@gmail.com',
            subject: "✅ SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
            body: "Build passed and application deployed.\n\n${env.BUILD_URL}",
            mimeType: 'text/plain'
        )
    }
    failure {
        emailext (
            to: 'recipient@gmail.com',
            subject: "❌ FAILURE: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
            body: "Build failed. Check logs.\n\n${env.BUILD_URL}console",
            attachLog: true,
            mimeType: 'text/plain'
        )
    }
}
```

---

### Step 7 — GitHub Webhook (Auto Trigger)

#### Add Webhook in GitHub

**GitHub Repo → Settings → Webhooks → Add Webhook**

```
Payload URL:    http://<EC2-IP>:8080/github-webhook/
Content type:   application/json
Events:         Just the push event
SSL:            Disable (HTTP only)
```

#### Enable in Jenkins Job

**Job → Configure → Build Triggers**

```
✅ GitHub hook trigger for GITScm polling
```

#### Jenkinsfile Trigger Block

```groovy
triggers {
    githubPush()
}
```

---

### Step 8 — Post Actions & Workspace Cleanup

```groovy
post {
    always {
        // Remove old Docker images, keep current running image
        sh """
            docker images nikhil74/${DOCKER_IMAGE} --format '{{.Tag}}' | \
            grep -v '^${DOCKER_TAG}\$' | \
            xargs -I {} docker rmi nikhil74/${DOCKER_IMAGE}:{} || true

            docker rmi ${DOCKER_IMAGE}:${DOCKER_TAG} || true
            docker image prune -f || true
        """
        echo "Old Docker images cleaned up (kept: ${DOCKER_IMAGE}:${DOCKER_TAG})"
        cleanWs()
    }
    success {
        echo "✅ Pipeline succeeded — Build ${env.BUILD_NUMBER} deployed successfully"
    }
    failure {
        echo "❌ Pipeline failed — Build ${env.BUILD_NUMBER}"
    }
}
```

---

## Common Issues & Resolutions

| Issue | Cause | Fix |
|---|---|---|
| SonarQube Quality Gate taking too long | Low server resources / Elasticsearch lag | Set `vm.max_map_count=524288` on host, use PostgreSQL DB |
| OWASP `--nvdApiKey` unrecognized | Plugin version too old | Use `dependency-check 6.5.1` or upgrade plugin |
| Email sending to `null` | Wrong recipient format or double quotes on `$DEFAULT_RECIPIENTS` | Use single quotes: `'$DEFAULT_RECIPIENTS'` |
| Email "Address not found" bounce | From address mismatch with SMTP account | Set System Admin email = sender Gmail account |
| `docker rmi` conflict on running container | Container holds image reference | Use `--force` flag: `docker rmi --force` |
| Pipeline FAILURE despite successful deploy | Earlier stage (e.g. OWASP) failed, marking build failed | Fix failing stage or use `catchError` to continue |
| GitHub webhook 403 error | Jenkins CSRF protection | Disable "Prevent Cross Site Request Forgery" in security config |

---

## Security Ports Summary

| Service | Port | Access |
|---|---|---|
| Jenkins | `8080` | Public (EC2 Security Group) |
| SonarQube | `9000` | Public or Internal |
| Application | `5453` | Public |
| Docker Registry | — | Docker Hub (external) |

---

## Result

Once all steps are configured, every `git push` to the repository will:

1. Automatically trigger the Jenkins pipeline via GitHub webhook
2. Run tests, security scans, and quality checks
3. Build and push a versioned Docker image to Docker Hub
4. Deploy the latest container on port `5453`
5. Verify the application is live via health check
6. Send an email notification with build result
7. Clean up old images and workspace
