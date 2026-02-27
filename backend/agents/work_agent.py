# NEXUS AI - Work Agent
"""
AI agent for DevOps workflows, project management, and engineering productivity.

This module implements the WorkAgent, a NEXUS AI agent that provides
comprehensive support for software engineering and DevOps workflows including:

- **CI/CD Pipeline Management:** Guidance on building, configuring, and
  troubleshooting continuous integration and continuous deployment pipelines
  across platforms such as GitHub Actions, GitLab CI, Azure DevOps, Jenkins,
  and CircleCI. Covers YAML authoring, stage/job orchestration, parallelism,
  caching strategies, artifact management, and secret injection.
- **Kubernetes Operations:** Assistance with cluster management, pod
  debugging, service mesh configuration, Helm chart authoring, resource
  quota tuning, horizontal and vertical autoscaling, rolling updates,
  blue/green and canary deployments, and RBAC policies.
- **Docker Containerisation:** Dockerfile optimisation, multi-stage builds,
  layer caching, image scanning, Docker Compose orchestration, volume
  management, network configuration, and best practices for minimal and
  secure container images.
- **Git Workflow Management:** Branch strategy guidance (GitFlow, trunk-based),
  merge/rebase strategies, conflict resolution tips, commit message
  conventions, tag and release management, submodule handling, and mono-repo
  tooling recommendations.
- **Deployment Automation:** Infrastructure-as-code tips (Terraform, Pulumi),
  environment promotion strategies, rollback procedures, feature flag
  integration, and zero-downtime deployment techniques.
- **Monitoring & Observability:** Advice on metrics collection (Prometheus,
  Datadog), log aggregation (ELK, Loki), distributed tracing (Jaeger,
  OpenTelemetry), alerting rules, SLO/SLI definition, and incident
  response playbooks.
- **Project Management:** Sprint planning, deadline tracking, task
  prioritization (Eisenhower matrix, MoSCoW), capacity estimation, burndown
  analysis, and Agile/Scrum ceremony facilitation.
- **Meeting Management:** Agenda generation, meeting-note summarisation,
  action-item extraction, calendar conflict detection, and smart scheduling
  recommendations.
- **Code Review Assistance:** Review checklist generation, common anti-pattern
  detection, PR description templates, review comment drafting, and
  best-practice enforcement guidance.

The agent publishes events to the NEXUS event bus so other agents can react
to work-related signals such as deployment notifications, deadline warnings,
or meeting reminders.
"""

import json
import re
import time
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from loguru import logger

from .base_agent import (
    BaseAgent,
    AgentCapability,
    AgentContext,
    AgentResponse,
)


# ---------------------------------------------------------------------------
# Constants & configuration
# ---------------------------------------------------------------------------

# Supported CI/CD platforms and their configuration file names
CICD_PLATFORMS: Dict[str, str] = {
    "github_actions": ".github/workflows/*.yml",
    "gitlab_ci": ".gitlab-ci.yml",
    "azure_devops": "azure-pipelines.yml",
    "jenkins": "Jenkinsfile",
    "circleci": ".circleci/config.yml",
    "travis": ".travis.yml",
}

# Common Kubernetes resource types for quick reference
K8S_RESOURCE_TYPES: List[str] = [
    "Pod", "Deployment", "StatefulSet", "DaemonSet", "ReplicaSet",
    "Service", "Ingress", "ConfigMap", "Secret", "PersistentVolumeClaim",
    "HorizontalPodAutoscaler", "NetworkPolicy", "ServiceAccount",
    "ClusterRole", "ClusterRoleBinding", "Job", "CronJob", "Namespace",
]

# Docker best-practice base images by language
DOCKER_BASE_IMAGES: Dict[str, str] = {
    "python": "python:3.12-slim",
    "node": "node:20-alpine",
    "java": "eclipse-temurin:21-jre-alpine",
    "go": "golang:1.22-alpine",
    "rust": "rust:1.77-slim",
    "dotnet": "mcr.microsoft.com/dotnet/aspnet:8.0-alpine",
}

# Git branching strategy templates
GIT_STRATEGIES: Dict[str, List[str]] = {
    "gitflow": ["main", "develop", "feature/*", "release/*", "hotfix/*"],
    "trunk_based": ["main", "feature/*", "release/*"],
    "github_flow": ["main", "feature/*"],
}

# Monitoring tool categories
MONITORING_CATEGORIES: Dict[str, List[str]] = {
    "metrics": ["Prometheus", "Datadog", "Grafana", "New Relic", "CloudWatch"],
    "logging": ["ELK Stack", "Loki", "Splunk", "Fluentd", "Papertrail"],
    "tracing": ["Jaeger", "Zipkin", "OpenTelemetry", "AWS X-Ray", "Honeycomb"],
    "alerting": ["PagerDuty", "OpsGenie", "VictorOps", "Slack Webhooks"],
}

# Project management methodology templates
PM_METHODOLOGIES: Dict[str, str] = {
    "scrum": "Sprint-based iterative development with daily standups",
    "kanban": "Continuous flow with WIP limits and visual boards",
    "scrumban": "Hybrid of Scrum ceremonies with Kanban flow",
    "xp": "Extreme Programming with pair programming and TDD",
    "lean": "Waste elimination and value stream optimisation",
}


class WorkAgent(BaseAgent):
    """
    DevOps and engineering productivity agent that:

    - Provides CI/CD pipeline guidance and troubleshooting
    - Assists with Kubernetes cluster operations and debugging
    - Offers Docker best-practices and Dockerfile optimisation
    - Recommends Git branching strategies and resolves conflicts
    - Helps plan and track deployments with rollback strategies
    - Advises on monitoring, alerting, and observability stacks
    - Manages projects with Agile ceremonies and deadline tracking
    - Facilitates meetings with agenda generation and note summarisation
    - Assists code reviews with checklists and anti-pattern detection

    The agent maintains an internal registry of tracked projects, upcoming
    deadlines, scheduled meetings, and recent deployments to provide
    context-aware advice.
    """

    def __init__(self) -> None:
        super().__init__(
            name="work",
            description=(
                "DevOps and engineering productivity agent for CI/CD, "
                "Kubernetes, Docker, Git, monitoring, project management, "
                "meetings, and code reviews"
            ),
        )

        # Internal state stores
        self._projects: Dict[str, Dict[str, Any]] = {}
        self._deadlines: List[Dict[str, Any]] = []
        self._meetings: List[Dict[str, Any]] = []
        self._deployments: List[Dict[str, Any]] = []
        self._reviews: List[Dict[str, Any]] = []
        self._pipeline_runs: List[Dict[str, Any]] = []

        # Configuration defaults
        self._preferred_cicd: str = "github_actions"
        self._preferred_git_strategy: str = "trunk_based"
        self._default_k8s_namespace: str = "default"

        logger.info("WorkAgent initialised with DevOps capabilities")

    # ------------------------------------------------------------------
    # BaseAgent interface implementation
    # ------------------------------------------------------------------

    def get_system_prompt(self) -> str:
        """Return the comprehensive system prompt for the Work agent."""
        return """You are NEXUS Work Agent — a senior-level DevOps and software engineering 
productivity assistant embedded inside the NEXUS AI platform.

YOUR IDENTITY:
You combine deep expertise in cloud-native infrastructure, release engineering,
and Agile project management. You communicate concisely, prefer actionable
advice over theoretical discussion, and always ground recommendations in
industry best-practices (12-factor app, DORA metrics, SRE principles).

CORE COMPETENCIES:
1. **CI/CD Pipelines** — Author, debug, and optimise pipelines for GitHub
   Actions, GitLab CI, Azure DevOps, Jenkins, and CircleCI. Cover caching,
   parallelism, matrix builds, secret management, and artifact publishing.
2. **Kubernetes** — Cluster operations, manifest authoring, Helm charts,
   Kustomize overlays, debugging CrashLoopBackOff/OOMKilled pods, RBAC,
   network policies, autoscaling, and service mesh (Istio/Linkerd).
3. **Docker** — Multi-stage builds, layer optimisation, security scanning
   (Trivy/Snyk), Compose orchestration, BuildKit features, and distroless
   base images.
4. **Git** — Branch strategies, rebase vs merge, interactive rebase,
   bisect, cherry-pick, submodules, worktrees, hooks, and commit
   conventions (Conventional Commits).
5. **Deployment** — Blue/green, canary, rolling updates, feature flags,
   infrastructure-as-code (Terraform/Pulumi), environment promotion, and
   zero-downtime migrations.
6. **Monitoring & Observability** — Prometheus/Grafana dashboards, ELK/Loki
   log aggregation, OpenTelemetry tracing, SLO/SLI/error-budget,
   alerting rules, and incident response runbooks.
7. **Project Management** — Sprint planning, backlog grooming, story
   pointing, burndown tracking, retrospective facilitation, and
   deadline/milestone management.
8. **Meeting Management** — Agenda generation, note summarisation, action
   item extraction, calendar conflict detection, and async standup formats.
9. **Code Review** — Review checklists, anti-pattern flagging, PR
   description templates, approval workflows, and CODEOWNERS setup.

RESPONSE GUIDELINES:
- Always provide concrete code snippets, YAML samples, or CLI commands.
- Use Markdown formatting with headers, lists, and code blocks.
- When comparing options, use tables.
- Warn about security implications (leaked secrets, overly broad RBAC).
- Suggest follow-up actions or related tasks.
- Keep responses focused — avoid unnecessary preamble."""

    def get_capabilities(self) -> List[AgentCapability]:
        """Return the list of capabilities this agent provides."""
        return [
            AgentCapability.CHAT,
            AgentCapability.ANALYZE,
            AgentCapability.GENERATE,
            AgentCapability.AUTOMATE,
            AgentCapability.MONITOR,
            AgentCapability.SUMMARIZE,
        ]

    async def process(self, context: AgentContext) -> AgentResponse:
        """
        Process an incoming work-related query or command.

        Detects the user's intent, delegates to the appropriate handler,
        and returns a rich Markdown response with actionable advice.
        """
        message = context.message.lower().strip()
        intent = self._detect_work_intent(message)
        logger.debug(f"WorkAgent detected intent: {intent} for message: {message[:80]}")

        handlers: Dict[str, Any] = {
            "ci_cd": self._handle_ci_cd,
            "kubernetes": self._handle_kubernetes,
            "docker": self._handle_docker,
            "git": self._handle_git,
            "deployment": self._handle_deployment,
            "monitoring": self._handle_monitoring,
            "project_management": self._handle_project_management,
            "meeting": self._handle_meeting,
            "code_review": self._handle_code_review,
            "general_work": self._handle_general_work,
        }

        handler = handlers.get(intent, self._handle_general_work)

        try:
            return await handler(context, message)
        except Exception as exc:
            logger.error(f"WorkAgent handler error ({intent}): {exc}")
            return AgentResponse(
                content=(
                    "⚠️ I encountered an issue while processing your work request. "
                    "Please try rephrasing or provide more details."
                ),
                agent_name=self.name,
                confidence=0.0,
                error=str(exc),
            )

    # ------------------------------------------------------------------
    # Intent detection
    # ------------------------------------------------------------------

    def _detect_work_intent(self, message: str) -> str:
        """
        Detect the work-related intent from a user's message.

        Scans keyword lists in priority order and returns the first match.
        Falls back to ``general_work`` when no keywords trigger.
        """
        intents: Dict[str, List[str]] = {
            "ci_cd": [
                "ci/cd", "cicd", "pipeline", "github actions", "gitlab ci",
                "jenkins", "circleci", "azure devops", "continuous integration",
                "continuous deployment", "build pipeline", "workflow run",
                "pipeline fail", "yaml pipeline", "build step", "ci pipeline",
            ],
            "kubernetes": [
                "kubernetes", "k8s", "kubectl", "pod", "deployment manifest",
                "helm", "kustomize", "namespace", "service mesh", "ingress",
                "configmap", "secret k8s", "hpa", "autoscal", "node pool",
                "cluster", "crashloopbackoff", "oomkilled", "statefulset",
            ],
            "docker": [
                "docker", "dockerfile", "container", "docker-compose",
                "compose", "image", "multi-stage", "buildkit", "registry",
                "docker build", "docker run", "docker push", "layer",
                "distroless", "trivy", "container scan",
            ],
            "git": [
                "git ", "branch", "merge", "rebase", "cherry-pick", "bisect",
                "commit", "pull request", "pr ", "gitflow", "trunk-based",
                "conflict", "stash", "worktree", "submodule", "tag",
                "conventional commit", "git hook",
            ],
            "deployment": [
                "deploy", "release", "rollback", "blue/green", "canary",
                "rolling update", "feature flag", "terraform", "pulumi",
                "infrastructure as code", "iac", "zero downtime",
                "environment promot", "staging", "production release",
            ],
            "monitoring": [
                "monitor", "prometheus", "grafana", "datadog", "alert",
                "observ", "logging", "elk", "loki", "tracing", "jaeger",
                "opentelemetry", "slo", "sli", "error budget", "incident",
                "pagerduty", "on-call", "runbook", "dashboard",
            ],
            "project_management": [
                "project", "sprint", "backlog", "story point", "standup",
                "retrospective", "deadline", "milestone", "kanban", "scrum",
                "task", "jira", "ticket", "epic", "velocity", "burndown",
                "capacity", "roadmap", "prioriti",
            ],
            "meeting": [
                "meeting", "agenda", "calendar", "schedule meeting",
                "meeting notes", "action item", "standup", "retro",
                "one-on-one", "1:1", "sync", "huddle",
            ],
            "code_review": [
                "code review", "review", "pull request review", "pr review",
                "codeowners", "review checklist", "approve pr", "lgtm",
                "nit", "anti-pattern", "review comment",
            ],
        }

        for intent, keywords in intents.items():
            if any(kw in message for kw in keywords):
                return intent

        return "general_work"

    # ------------------------------------------------------------------
    # Handlers
    # ------------------------------------------------------------------

    async def _handle_ci_cd(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle CI/CD pipeline queries with platform-specific guidance."""
        platform = self._detect_cicd_platform(message)
        config_file = CICD_PLATFORMS.get(platform, CICD_PLATFORMS["github_actions"])

        content = (
            f"## 🔄 CI/CD Pipeline Guidance — {platform.replace('_', ' ').title()}\n\n"
            f"**Config location:** `{config_file}`\n\n"
            "### Quick-Start Pipeline Template\n\n"
            "```yaml\n"
            "name: CI Pipeline\n"
            "on:\n"
            "  push:\n"
            "    branches: [main, develop]\n"
            "  pull_request:\n"
            "    branches: [main]\n\n"
            "jobs:\n"
            "  build-and-test:\n"
            "    runs-on: ubuntu-latest\n"
            "    steps:\n"
            "      - uses: actions/checkout@v4\n"
            "      - name: Set up environment\n"
            "        run: echo \"Setting up...\"\n"
            "      - name: Install dependencies\n"
            "        run: pip install -r requirements.txt\n"
            "      - name: Run tests\n"
            "        run: pytest --cov\n"
            "      - name: Lint\n"
            "        run: ruff check .\n"
            "```\n\n"
            "### Best Practices\n\n"
            "| Practice | Recommendation |\n"
            "|----------|----------------|\n"
            "| Caching | Cache dependency directories (`~/.cache/pip`, `node_modules`) |\n"
            "| Secrets | Use platform secret store — never hard-code credentials |\n"
            "| Parallelism | Split tests with matrix strategy for faster feedback |\n"
            "| Artifacts | Upload build artifacts for traceability |\n"
            "| Notifications | Alert on failure via Slack/Teams webhook |\n\n"
            "Need help with a specific pipeline issue? Share the error output and I'll debug it."
        )

        run_id = str(uuid.uuid4())[:8]
        self._pipeline_runs.append({
            "id": run_id,
            "platform": platform,
            "timestamp": datetime.utcnow().isoformat(),
            "query": message[:120],
        })

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.88,
            metadata={"intent": "ci_cd", "platform": platform, "run_id": run_id},
            suggestions=[
                "Show me how to add caching to my pipeline",
                "Help me set up a matrix build",
                "How do I publish Docker images from CI?",
            ],
        )

    async def _handle_kubernetes(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle Kubernetes operations and debugging."""
        resource = self._detect_k8s_resource(message)
        namespace = self._default_k8s_namespace

        content = (
            "## ☸️ Kubernetes Assistance\n\n"
            f"**Detected resource:** `{resource}` | **Namespace:** `{namespace}`\n\n"
            "### Common Debugging Commands\n\n"
            "```bash\n"
            f"# Describe the resource for events and conditions\n"
            f"kubectl describe {resource.lower()} <name> -n {namespace}\n\n"
            f"# Stream logs from a pod\n"
            f"kubectl logs -f <pod-name> -n {namespace}\n\n"
            f"# Get all resources with wide output\n"
            f"kubectl get {resource.lower()} -n {namespace} -o wide\n\n"
            f"# Execute into a running container\n"
            f"kubectl exec -it <pod-name> -n {namespace} -- /bin/sh\n"
            "```\n\n"
            "### Resource Health Checklist\n\n"
            "- ✅ Check pod status and restart count\n"
            "- ✅ Verify resource requests/limits are set\n"
            "- ✅ Inspect events for scheduling failures\n"
            "- ✅ Confirm image pull secrets if using private registry\n"
            "- ✅ Review liveness/readiness probe configuration\n"
            "- ✅ Check node affinity and taint tolerations\n\n"
            "Share specific error output and I'll provide targeted troubleshooting steps."
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.86,
            metadata={"intent": "kubernetes", "resource": resource, "namespace": namespace},
            suggestions=[
                "How do I set up HPA for my deployment?",
                "Help me write a Helm chart",
                "Debug CrashLoopBackOff on my pod",
            ],
        )

    async def _handle_docker(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle Docker and containerisation queries."""
        language = self._detect_language_context(message)
        base_image = DOCKER_BASE_IMAGES.get(language, "ubuntu:22.04")

        content = (
            "## 🐳 Docker Guidance\n\n"
            f"**Suggested base image:** `{base_image}`\n\n"
            "### Optimised Multi-Stage Dockerfile\n\n"
            "```dockerfile\n"
            f"# Stage 1: Build\n"
            f"FROM {base_image} AS builder\n"
            "WORKDIR /app\n"
            "COPY requirements.txt .\n"
            "RUN pip install --no-cache-dir -r requirements.txt\n"
            "COPY . .\n\n"
            "# Stage 2: Runtime\n"
            f"FROM {base_image}\n"
            "WORKDIR /app\n"
            "COPY --from=builder /app .\n"
            "EXPOSE 8000\n"
            'HEALTHCHECK CMD curl -f http://localhost:8000/health || exit 1\n'
            'CMD ["python", "main.py"]\n'
            "```\n\n"
            "### Docker Best Practices\n\n"
            "| Practice | Why |\n"
            "|----------|-----|\n"
            "| Use `.dockerignore` | Exclude unnecessary files, reduce context size |\n"
            "| Multi-stage builds | Smaller final image, no build tools in production |\n"
            "| Pin versions | Reproducible builds (`python:3.12.2`, not `python:latest`) |\n"
            "| Non-root user | `USER 1000` — avoid running as root |\n"
            "| `--no-cache-dir` | Reduce layer size by skipping pip/npm cache |\n"
            "| Health checks | Enable orchestrator liveness detection |\n"
            "| Scan images | Run `trivy image <tag>` before pushing |\n\n"
            "### Useful Commands\n\n"
            "```bash\n"
            "# Build with BuildKit for better caching\n"
            "DOCKER_BUILDKIT=1 docker build -t myapp:latest .\n\n"
            "# Inspect image layers\n"
            "docker history myapp:latest\n\n"
            "# Scan for vulnerabilities\n"
            "trivy image myapp:latest\n"
            "```\n"
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.87,
            metadata={"intent": "docker", "language": language, "base_image": base_image},
            suggestions=[
                "Help me reduce my Docker image size",
                "Set up Docker Compose for local development",
                "How do I push to a private registry?",
            ],
        )

    async def _handle_git(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle Git workflow and version control queries."""
        strategy = self._preferred_git_strategy
        branches = GIT_STRATEGIES.get(strategy, GIT_STRATEGIES["trunk_based"])

        content = (
            "## 🌿 Git Workflow Guidance\n\n"
            f"**Active strategy:** {strategy.replace('_', ' ').title()}\n"
            f"**Branch structure:** `{'`, `'.join(branches)}`\n\n"
            "### Branch Naming Conventions\n\n"
            "```\n"
            "feature/TICKET-123-add-user-auth\n"
            "bugfix/TICKET-456-fix-login-redirect\n"
            "hotfix/TICKET-789-patch-xss-vuln\n"
            "release/v2.3.0\n"
            "```\n\n"
            "### Commit Message Format (Conventional Commits)\n\n"
            "```\n"
            "feat(auth): add OAuth2 login flow\n"
            "fix(api): handle null response from payment gateway\n"
            "docs(readme): update deployment instructions\n"
            "refactor(db): migrate to connection pooling\n"
            "test(auth): add unit tests for token refresh\n"
            "ci(actions): add code coverage reporting\n"
            "```\n\n"
            "### Common Operations\n\n"
            "```bash\n"
            "# Interactive rebase last 3 commits\n"
            "git rebase -i HEAD~3\n\n"
            "# Find which commit introduced a bug\n"
            "git bisect start && git bisect bad && git bisect good <sha>\n\n"
            "# Stash with a descriptive message\n"
            "git stash push -m 'WIP: refactoring auth module'\n\n"
            "# Cherry-pick a commit from another branch\n"
            "git cherry-pick <commit-sha>\n"
            "```\n\n"
            "Need help resolving a merge conflict or choosing a branching strategy? "
            "Share the details!"
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.85,
            metadata={"intent": "git", "strategy": strategy},
            suggestions=[
                "Help me resolve a merge conflict",
                "Should I use rebase or merge?",
                "Set up Git hooks for linting",
            ],
        )

    async def _handle_deployment(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle deployment automation and release management."""
        deploy_id = str(uuid.uuid4())[:8]

        content = (
            "## 🚀 Deployment & Release Management\n\n"
            f"**Reference ID:** `deploy-{deploy_id}`\n\n"
            "### Deployment Strategy Comparison\n\n"
            "| Strategy | Downtime | Rollback | Complexity | Risk |\n"
            "|----------|----------|----------|------------|------|\n"
            "| Rolling Update | None | Medium | Low | Low |\n"
            "| Blue/Green | None | Instant | Medium | Low |\n"
            "| Canary | None | Fast | High | Very Low |\n"
            "| Recreate | Yes | Slow | Low | High |\n"
            "| A/B Testing | None | Fast | High | Low |\n\n"
            "### Pre-Deployment Checklist\n\n"
            "- [ ] All tests passing on CI\n"
            "- [ ] Database migrations tested in staging\n"
            "- [ ] Environment variables configured\n"
            "- [ ] Rollback plan documented\n"
            "- [ ] Monitoring dashboards ready\n"
            "- [ ] Stakeholders notified\n"
            "- [ ] Feature flags configured for progressive rollout\n"
            "- [ ] Load test results reviewed\n\n"
            "### Rollback Procedure\n\n"
            "```bash\n"
            "# Kubernetes rollback\n"
            "kubectl rollout undo deployment/myapp -n production\n\n"
            "# Verify rollback\n"
            "kubectl rollout status deployment/myapp -n production\n\n"
            "# Terraform rollback (apply previous state)\n"
            "terraform plan -target=module.app -var-file=prod.tfvars\n"
            "```\n"
        )

        self._deployments.append({
            "id": deploy_id,
            "timestamp": datetime.utcnow().isoformat(),
            "query": message[:120],
        })

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.87,
            metadata={"intent": "deployment", "deploy_id": deploy_id},
            suggestions=[
                "Help me set up a canary deployment",
                "Create a Terraform module for my app",
                "How do I implement feature flags?",
            ],
        )

    async def _handle_monitoring(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle monitoring, alerting, and observability guidance."""

        content = (
            "## 📊 Monitoring & Observability\n\n"
            "### The Three Pillars\n\n"
            "| Pillar | Tools | Purpose |\n"
            "|--------|-------|---------|\n"
            "| **Metrics** | Prometheus, Grafana, Datadog | Quantitative measurements over time |\n"
            "| **Logs** | ELK Stack, Loki, Fluentd | Event records for debugging |\n"
            "| **Traces** | Jaeger, OpenTelemetry, Zipkin | Request flow across services |\n\n"
            "### SLO / SLI Quick Reference\n\n"
            "```yaml\n"
            "# Example SLO definition\n"
            "slo:\n"
            "  name: api-availability\n"
            "  target: 99.9%  # Three nines\n"
            "  window: 30d\n"
            "  sli:\n"
            "    type: availability\n"
            "    good_events: successful_requests\n"
            "    total_events: total_requests\n"
            "  error_budget: 43.2m  # per 30-day window\n"
            "```\n\n"
            "### Alert Rule Template (Prometheus)\n\n"
            "```yaml\n"
            "groups:\n"
            "  - name: api-alerts\n"
            "    rules:\n"
            "      - alert: HighErrorRate\n"
            "        expr: rate(http_requests_total{status=~\"5..\"}[5m]) > 0.05\n"
            "        for: 5m\n"
            "        labels:\n"
            "          severity: critical\n"
            "        annotations:\n"
            "          summary: \"High 5xx error rate detected\"\n"
            "          runbook: \"https://wiki.internal/runbooks/high-error-rate\"\n"
            "```\n\n"
            "### Incident Response Flow\n\n"
            "1. **Detect** — Alert fires → page on-call engineer\n"
            "2. **Triage** — Assess severity (P1–P4) and blast radius\n"
            "3. **Mitigate** — Apply quick fix or rollback\n"
            "4. **Resolve** — Root-cause fix deployed\n"
            "5. **Post-mortem** — Blameless review within 48 hours\n"
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.86,
            metadata={"intent": "monitoring"},
            suggestions=[
                "Help me create a Grafana dashboard",
                "Set up OpenTelemetry for my Python app",
                "Write an incident response runbook",
            ],
        )

    async def _handle_project_management(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle project management and Agile workflow queries."""
        methodology = self._detect_pm_methodology(message)
        method_desc = PM_METHODOLOGIES.get(methodology, PM_METHODOLOGIES["scrum"])

        content = (
            "## 📋 Project Management\n\n"
            f"**Methodology:** {methodology.title()} — _{method_desc}_\n\n"
            "### Sprint Planning Template\n\n"
            "| Item | Story Points | Priority | Assignee | Status |\n"
            "|------|-------------|----------|----------|--------|\n"
            "| User auth refactor | 8 | High | — | To Do |\n"
            "| API rate limiting | 5 | Medium | — | To Do |\n"
            "| Dashboard redesign | 13 | High | — | To Do |\n"
            "| Bug: login redirect | 2 | Critical | — | To Do |\n\n"
            "### Eisenhower Priority Matrix\n\n"
            "```\n"
            "         URGENT          NOT URGENT\n"
            "  ┌─────────────────┬─────────────────┐\n"
            "  │   DO FIRST      │   SCHEDULE      │\n"
            "I │ Production bugs │ Tech debt       │\n"
            "M │ Security patches│ Refactoring     │\n"
            "P │ Client blockers │ Documentation   │\n"
            "  ├─────────────────┼─────────────────┤\n"
            "  │   DELEGATE      │   ELIMINATE     │\n"
            "N │ Minor bug fixes │ Unused features │\n"
            "O │ Routine updates │ Excessive       │\n"
            "T │ Status reports  │   meetings      │\n"
            "  └─────────────────┴─────────────────┘\n"
            "```\n\n"
            "### Upcoming Deadlines\n\n"
            f"Currently tracking **{len(self._deadlines)}** deadline(s).\n\n"
            "Would you like me to help with sprint planning, estimate story points, "
            "or create a project roadmap?"
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.84,
            metadata={"intent": "project_management", "methodology": methodology},
            suggestions=[
                "Help me estimate story points for these tasks",
                "Generate a sprint retrospective template",
                "Create a project roadmap for Q2",
            ],
        )

    async def _handle_meeting(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle meeting management, agenda creation, and note summarisation."""
        meeting_id = str(uuid.uuid4())[:8]

        content = (
            "## 📅 Meeting Management\n\n"
            f"**Reference:** `meeting-{meeting_id}`\n\n"
            "### Meeting Agenda Template\n\n"
            "```markdown\n"
            "# Team Sync — [Date]\n\n"
            "**Duration:** 30 min | **Facilitator:** [Name]\n\n"
            "## Agenda\n"
            "1. [ ] Review action items from last meeting (5 min)\n"
            "2. [ ] Sprint progress update (10 min)\n"
            "3. [ ] Blockers and dependencies (5 min)\n"
            "4. [ ] Upcoming deadlines (5 min)\n"
            "5. [ ] Open discussion (5 min)\n\n"
            "## Decisions Made\n"
            "- (to be filled)\n\n"
            "## Action Items\n"
            "| Action | Owner | Due |\n"
            "|--------|-------|-----|\n"
            "| | | |\n"
            "```\n\n"
            "### Async Standup Format\n\n"
            "```\n"
            "🟢 Yesterday: Completed API rate limiting implementation\n"
            "🔵 Today: Starting dashboard redesign\n"
            "🔴 Blockers: Waiting on design assets from UX team\n"
            "```\n\n"
            "### Tips for Effective Meetings\n\n"
            "- Always have a written agenda shared beforehand\n"
            "- Assign a note-taker before the meeting starts\n"
            "- Time-box each agenda item\n"
            "- End with clear action items, owners, and due dates\n"
            "- Cancel meetings that lack a clear purpose\n\n"
            f"Currently tracking **{len(self._meetings)}** scheduled meeting(s)."
        )

        self._meetings.append({
            "id": meeting_id,
            "timestamp": datetime.utcnow().isoformat(),
            "query": message[:120],
        })

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.83,
            metadata={"intent": "meeting", "meeting_id": meeting_id},
            suggestions=[
                "Generate meeting notes from a transcript",
                "Schedule a recurring standup",
                "Create a retrospective agenda",
            ],
        )

    async def _handle_code_review(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle code review assistance and checklist generation."""
        review_id = str(uuid.uuid4())[:8]

        content = (
            "## 🔍 Code Review Assistance\n\n"
            f"**Review Reference:** `review-{review_id}`\n\n"
            "### Code Review Checklist\n\n"
            "#### Functionality\n"
            "- [ ] Code correctly implements the requirements\n"
            "- [ ] Edge cases are handled\n"
            "- [ ] Error handling is appropriate and consistent\n"
            "- [ ] No unintended side effects\n\n"
            "#### Code Quality\n"
            "- [ ] Follows project coding standards and style guide\n"
            "- [ ] No code duplication (DRY principle)\n"
            "- [ ] Functions/methods have single responsibility\n"
            "- [ ] Names are descriptive and consistent\n"
            "- [ ] No magic numbers — use named constants\n\n"
            "#### Security\n"
            "- [ ] No hardcoded credentials or secrets\n"
            "- [ ] Input validation on all user-facing endpoints\n"
            "- [ ] SQL injection / XSS protections in place\n"
            "- [ ] Sensitive data is not logged\n\n"
            "#### Testing\n"
            "- [ ] Unit tests cover new/changed logic\n"
            "- [ ] Tests are independent and deterministic\n"
            "- [ ] Edge cases have test coverage\n"
            "- [ ] Integration tests where applicable\n\n"
            "#### Documentation\n"
            "- [ ] Public APIs have docstrings\n"
            "- [ ] Complex logic has inline comments\n"
            "- [ ] README updated if behaviour changes\n"
            "- [ ] CHANGELOG entry added\n\n"
            "### PR Description Template\n\n"
            "```markdown\n"
            "## Summary\n"
            "Brief description of changes.\n\n"
            "## Motivation\n"
            "Why is this change needed?\n\n"
            "## Changes\n"
            "- List key changes\n\n"
            "## Testing\n"
            "How was this tested?\n\n"
            "## Screenshots (if applicable)\n"
            "```\n"
        )

        self._reviews.append({
            "id": review_id,
            "timestamp": datetime.utcnow().isoformat(),
            "query": message[:120],
        })

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.85,
            metadata={"intent": "code_review", "review_id": review_id},
            suggestions=[
                "Review this code for anti-patterns",
                "Set up CODEOWNERS for my repo",
                "Generate review comments for a PR",
            ],
        )

    async def _handle_general_work(
        self, context: AgentContext, message: str
    ) -> AgentResponse:
        """Handle general work and engineering productivity queries."""

        content = (
            "## 🛠️ NEXUS Work Agent\n\n"
            "I'm your DevOps and engineering productivity assistant. "
            "Here's what I can help with:\n\n"
            "| Category | Examples |\n"
            "|----------|----------|\n"
            "| 🔄 **CI/CD** | Pipeline setup, debugging, optimisation |\n"
            "| ☸️ **Kubernetes** | Cluster ops, debugging pods, Helm charts |\n"
            "| 🐳 **Docker** | Dockerfiles, multi-stage builds, scanning |\n"
            "| 🌿 **Git** | Branch strategies, conflict resolution, hooks |\n"
            "| 🚀 **Deployment** | Blue/green, canary, rollback procedures |\n"
            "| 📊 **Monitoring** | Prometheus, Grafana, alerting, SLOs |\n"
            "| 📋 **Projects** | Sprint planning, deadlines, prioritisation |\n"
            "| 📅 **Meetings** | Agendas, notes, action items |\n"
            "| 🔍 **Code Review** | Checklists, PR templates, best practices |\n\n"
            "Just ask me anything about your engineering workflow and I'll provide "
            "actionable guidance with code snippets, YAML templates, and CLI commands."
        )

        return AgentResponse(
            content=content,
            agent_name=self.name,
            confidence=0.65,
            metadata={"intent": "general_work"},
            suggestions=[
                "Set up a CI/CD pipeline for my Python app",
                "Help me debug a Kubernetes deployment",
                "Create a sprint planning template",
            ],
        )

    # ------------------------------------------------------------------
    # Utility / helper methods
    # ------------------------------------------------------------------

    def _detect_cicd_platform(self, message: str) -> str:
        """Detect which CI/CD platform the user is asking about."""
        platform_keywords: Dict[str, List[str]] = {
            "github_actions": ["github action", "github workflow", "actions"],
            "gitlab_ci": ["gitlab", "gitlab ci", "gitlab-ci"],
            "azure_devops": ["azure devops", "azure pipeline", "ado"],
            "jenkins": ["jenkins", "jenkinsfile", "groovy pipeline"],
            "circleci": ["circleci", "circle ci", "circle"],
            "travis": ["travis", "travis ci"],
        }
        for platform, keywords in platform_keywords.items():
            if any(kw in message for kw in keywords):
                return platform
        return self._preferred_cicd

    def _detect_k8s_resource(self, message: str) -> str:
        """Detect which Kubernetes resource the user is referencing."""
        resource_keywords: Dict[str, List[str]] = {
            "Pod": ["pod", "container crash", "crashloop"],
            "Deployment": ["deployment", "replica", "rollout"],
            "Service": ["service", "clusterip", "nodeport", "loadbalancer"],
            "Ingress": ["ingress", "routing", "tls termination"],
            "ConfigMap": ["configmap", "config map", "configuration"],
            "Secret": ["secret", "credential", "sensitive"],
            "StatefulSet": ["statefulset", "stateful"],
            "DaemonSet": ["daemonset", "daemon"],
            "Job": ["job", "batch"],
            "CronJob": ["cronjob", "cron job", "scheduled job"],
            "HorizontalPodAutoscaler": ["hpa", "autoscal", "scale"],
            "PersistentVolumeClaim": ["pvc", "persistent volume", "storage"],
            "NetworkPolicy": ["network policy", "netpol"],
            "Namespace": ["namespace"],
        }
        for resource, keywords in resource_keywords.items():
            if any(kw in message for kw in keywords):
                return resource
        return "Deployment"

    def _detect_language_context(self, message: str) -> str:
        """Detect which programming language context the user is in."""
        lang_keywords: Dict[str, List[str]] = {
            "python": ["python", "pip", "django", "flask", "fastapi", "pytest"],
            "node": ["node", "npm", "yarn", "express", "react", "next.js"],
            "java": ["java", "maven", "gradle", "spring", "jvm"],
            "go": ["golang", "go ", "go mod"],
            "rust": ["rust", "cargo", "tokio"],
            "dotnet": [".net", "dotnet", "csharp", "c#", "aspnet"],
        }
        for lang, keywords in lang_keywords.items():
            if any(kw in message for kw in keywords):
                return lang
        return "python"

    def _detect_pm_methodology(self, message: str) -> str:
        """Detect which project management methodology the user prefers."""
        method_keywords: Dict[str, List[str]] = {
            "scrum": ["scrum", "sprint", "standup", "retrospective"],
            "kanban": ["kanban", "wip limit", "board"],
            "scrumban": ["scrumban"],
            "xp": ["extreme programming", "pair programming", "tdd"],
            "lean": ["lean", "waste", "value stream"],
        }
        for method, keywords in method_keywords.items():
            if any(kw in message for kw in keywords):
                return method
        return "scrum"

    # ------------------------------------------------------------------
    # Project & deadline tracking helpers
    # ------------------------------------------------------------------

    def add_project(self, name: str, description: str, deadline: Optional[str] = None) -> str:
        """
        Register a new project for tracking.

        Args:
            name: Project name.
            description: Brief description of the project.
            deadline: Optional ISO-format deadline string.

        Returns:
            The generated project ID.
        """
        project_id = str(uuid.uuid4())[:8]
        self._projects[project_id] = {
            "name": name,
            "description": description,
            "deadline": deadline,
            "created_at": datetime.utcnow().isoformat(),
            "status": "active",
            "tasks": [],
        }
        logger.info(f"WorkAgent: project '{name}' registered as {project_id}")
        return project_id

    def add_deadline(self, title: str, due_date: str, project_id: Optional[str] = None) -> str:
        """
        Add a deadline to the tracking list.

        Args:
            title: Deadline title.
            due_date: ISO-format due date string.
            project_id: Optional associated project ID.

        Returns:
            The generated deadline ID.
        """
        deadline_id = str(uuid.uuid4())[:8]
        self._deadlines.append({
            "id": deadline_id,
            "title": title,
            "due_date": due_date,
            "project_id": project_id,
            "created_at": datetime.utcnow().isoformat(),
            "completed": False,
        })
        logger.info(f"WorkAgent: deadline '{title}' added (due {due_date})")
        return deadline_id

    def get_upcoming_deadlines(self, days: int = 7) -> List[Dict[str, Any]]:
        """
        Return deadlines due within the specified number of days.

        Args:
            days: Look-ahead window in days.

        Returns:
            List of deadline dicts that fall within the window.
        """
        cutoff = (datetime.utcnow() + timedelta(days=days)).isoformat()
        return [
            d for d in self._deadlines
            if not d["completed"] and d["due_date"] <= cutoff
        ]

    def schedule_meeting(
        self,
        title: str,
        scheduled_at: str,
        duration_minutes: int = 30,
        attendees: Optional[List[str]] = None,
    ) -> str:
        """
        Schedule a new meeting.

        Args:
            title: Meeting title.
            scheduled_at: ISO-format start time.
            duration_minutes: Duration in minutes.
            attendees: Optional list of attendee names/emails.

        Returns:
            The generated meeting ID.
        """
        meeting_id = str(uuid.uuid4())[:8]
        self._meetings.append({
            "id": meeting_id,
            "title": title,
            "scheduled_at": scheduled_at,
            "duration_minutes": duration_minutes,
            "attendees": attendees or [],
            "created_at": datetime.utcnow().isoformat(),
            "notes": "",
            "action_items": [],
        })
        logger.info(f"WorkAgent: meeting '{title}' scheduled at {scheduled_at}")
        return meeting_id

    def get_agent_summary(self) -> Dict[str, Any]:
        """
        Return a summary of the agent's current tracked state.

        Includes counts of projects, deadlines, meetings, deployments,
        and reviews for dashboard display.
        """
        return {
            "agent": self.name,
            "projects": len(self._projects),
            "deadlines_total": len(self._deadlines),
            "deadlines_pending": len([d for d in self._deadlines if not d["completed"]]),
            "meetings": len(self._meetings),
            "deployments_logged": len(self._deployments),
            "reviews_logged": len(self._reviews),
            "pipeline_runs_logged": len(self._pipeline_runs),
            "preferred_cicd": self._preferred_cicd,
            "preferred_git_strategy": self._preferred_git_strategy,
        }
