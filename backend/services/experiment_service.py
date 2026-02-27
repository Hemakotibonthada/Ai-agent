"""
Experiment Tracking Service - A/B Testing and experiment management
Supports multivariate tests, canary releases, and statistical analysis
"""
import uuid
import math
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any, Tuple
from enum import Enum
from dataclasses import dataclass, field, asdict
from collections import defaultdict
import logging
import random
from services.demo_data_manager import is_demo_data_enabled

logger = logging.getLogger(__name__)


class ExperimentStatus(str, Enum):
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class ExperimentType(str, Enum):
    AB_TEST = "a/b"
    MULTIVARIATE = "multivariate"
    FEATURE_FLAG = "feature-flag"
    CANARY = "canary"
    BANDITS = "multi-armed-bandit"


@dataclass
class Variant:
    id: str
    name: str
    description: str = ""
    traffic_percentage: float = 50.0
    is_control: bool = False
    config: Dict[str, Any] = field(default_factory=dict)
    samples: int = 0
    conversions: int = 0
    total_value: float = 0.0
    
    @property
    def conversion_rate(self) -> float:
        return (self.conversions / self.samples * 100) if self.samples > 0 else 0.0
    
    @property
    def mean_value(self) -> float:
        return (self.total_value / self.samples) if self.samples > 0 else 0.0


@dataclass 
class Experiment:
    id: str
    name: str
    hypothesis: str
    description: str = ""
    type: ExperimentType = ExperimentType.AB_TEST
    status: ExperimentStatus = ExperimentStatus.DRAFT
    metric: str = "conversion_rate"
    metric_type: str = "proportion"  # proportion, continuous
    variants: List[Variant] = field(default_factory=list)
    traffic_percentage: float = 100.0
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    min_sample_size: int = 1000
    significance_level: float = 0.05
    minimum_detectable_effect: float = 5.0
    tags: List[str] = field(default_factory=list)
    owner: str = "admin"
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    results: Optional[Dict[str, Any]] = None
    daily_data: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class ExperimentEvent:
    experiment_id: str
    variant_id: str
    user_id: str
    event_type: str  # exposure, conversion, custom
    value: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())


class StatisticalEngine:
    """Statistical analysis for experiments."""
    
    @staticmethod
    def z_test_proportions(
        conversions_a: int, samples_a: int,
        conversions_b: int, samples_b: int,
    ) -> Dict[str, float]:
        """Two-proportion z-test."""
        if samples_a == 0 or samples_b == 0:
            return {"z_score": 0, "p_value": 1.0, "confidence": 0.0}
        
        p_a = conversions_a / samples_a
        p_b = conversions_b / samples_b
        p_pooled = (conversions_a + conversions_b) / (samples_a + samples_b)
        
        se = math.sqrt(p_pooled * (1 - p_pooled) * (1/samples_a + 1/samples_b))
        if se == 0:
            return {"z_score": 0, "p_value": 1.0, "confidence": 0.0}
        
        z = (p_b - p_a) / se
        
        # Approximate p-value using normal CDF approximation
        p_value = 2 * (1 - StatisticalEngine._normal_cdf(abs(z)))
        confidence = (1 - p_value) * 100
        
        lift = ((p_b - p_a) / p_a * 100) if p_a > 0 else 0
        
        return {
            "z_score": round(z, 4),
            "p_value": round(p_value, 6),
            "confidence": round(confidence, 2),
            "control_rate": round(p_a * 100, 4),
            "treatment_rate": round(p_b * 100, 4),
            "lift": round(lift, 2),
            "is_significant": p_value < 0.05,
        }
    
    @staticmethod
    def t_test_means(
        values_a: List[float],
        values_b: List[float],
    ) -> Dict[str, float]:
        """Two-sample t-test for continuous metrics."""
        n_a, n_b = len(values_a), len(values_b)
        if n_a < 2 or n_b < 2:
            return {"t_score": 0, "p_value": 1.0, "confidence": 0.0}
        
        mean_a = sum(values_a) / n_a
        mean_b = sum(values_b) / n_b
        
        var_a = sum((x - mean_a) ** 2 for x in values_a) / (n_a - 1)
        var_b = sum((x - mean_b) ** 2 for x in values_b) / (n_b - 1)
        
        se = math.sqrt(var_a / n_a + var_b / n_b)
        if se == 0:
            return {"t_score": 0, "p_value": 1.0, "confidence": 0.0}
        
        t = (mean_b - mean_a) / se
        
        # Welch's degrees of freedom
        df = ((var_a/n_a + var_b/n_b) ** 2) / (
            (var_a/n_a) ** 2 / (n_a - 1) + (var_b/n_b) ** 2 / (n_b - 1)
        )
        
        # Approximate p-value
        p_value = 2 * (1 - StatisticalEngine._normal_cdf(abs(t)))
        confidence = (1 - p_value) * 100
        
        lift = ((mean_b - mean_a) / mean_a * 100) if mean_a != 0 else 0
        
        return {
            "t_score": round(t, 4),
            "p_value": round(p_value, 6),
            "confidence": round(confidence, 2),
            "mean_a": round(mean_a, 4),
            "mean_b": round(mean_b, 4),
            "lift": round(lift, 2),
            "degrees_of_freedom": round(df, 2),
            "is_significant": p_value < 0.05,
        }
    
    @staticmethod
    def _normal_cdf(x: float) -> float:
        """Approximation of the standard normal CDF."""
        return 0.5 * (1 + math.erf(x / math.sqrt(2)))
    
    @staticmethod
    def required_sample_size(
        baseline_rate: float,
        mde: float,
        alpha: float = 0.05,
        power: float = 0.80,
    ) -> int:
        """Calculate required sample size per variant."""
        p1 = baseline_rate
        p2 = baseline_rate * (1 + mde / 100)
        
        z_alpha = 1.96 if alpha == 0.05 else 2.576  # Simplified
        z_beta = 0.84 if power == 0.80 else 1.28
        
        p_avg = (p1 + p2) / 2
        
        if p1 == p2 or p_avg == 0 or p_avg == 1:
            return 10000
        
        n = ((z_alpha * math.sqrt(2 * p_avg * (1 - p_avg)) + 
              z_beta * math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2) / ((p2 - p1) ** 2)
        
        return int(math.ceil(n))
    
    @staticmethod
    def bayesian_probability(
        conversions_a: int, samples_a: int,
        conversions_b: int, samples_b: int,
        simulations: int = 10000,
    ) -> Dict[str, float]:
        """Bayesian A/B test using Beta distribution simulation."""
        wins_b = 0
        for _ in range(simulations):
            # Beta distribution samples (using simple approximation)
            alpha_a = conversions_a + 1
            beta_a = (samples_a - conversions_a) + 1
            alpha_b = conversions_b + 1
            beta_b = (samples_b - conversions_b) + 1
            
            # Generate beta-distributed random samples
            sample_a = random.betavariate(alpha_a, beta_a)
            sample_b = random.betavariate(alpha_b, beta_b)
            
            if sample_b > sample_a:
                wins_b += 1
        
        prob_b_better = wins_b / simulations
        
        return {
            "probability_b_better": round(prob_b_better * 100, 2),
            "probability_a_better": round((1 - prob_b_better) * 100, 2),
            "simulations": simulations,
        }


class ExperimentService:
    """Complete experiment tracking and A/B testing service."""
    
    def __init__(self):
        self.experiments: Dict[str, Experiment] = {}
        self.events: List[ExperimentEvent] = []
        self.user_assignments: Dict[str, Dict[str, str]] = {}  # user_id -> {exp_id: variant_id}
        self.stats_engine = StatisticalEngine()
        if is_demo_data_enabled():
            self._init_sample_data()
    
    def _init_sample_data(self):
        """Create sample experiments."""
        experiments_data = [
            {
                "name": "Dashboard Layout v2",
                "hypothesis": "A grid-based dashboard leads to higher feature discovery",
                "type": ExperimentType.AB_TEST,
                "status": ExperimentStatus.RUNNING,
                "metric": "feature_clicks_per_session",
                "variants": [
                    Variant(id="ctrl", name="Control (Current)", is_control=True, traffic_percentage=50, samples=2260, conversions=340),
                    Variant(id="var_a", name="Grid Layout", traffic_percentage=50, samples=2260, conversions=398),
                ],
                "traffic_percentage": 50,
                "tags": ["ui", "dashboard"],
            },
            {
                "name": "Voice Command Wake Word",
                "hypothesis": "Shorter wake words increase voice activation rate",
                "type": ExperimentType.MULTIVARIATE,
                "status": ExperimentStatus.COMPLETED,
                "metric": "activations_per_day",
                "variants": [
                    Variant(id="ctrl", name="Hey Nexus", is_control=True, traffic_percentage=34, samples=2977, conversions=149),
                    Variant(id="var_a", name="Nexus", traffic_percentage=33, samples=2947, conversions=221),
                    Variant(id="var_b", name="Hey AI", traffic_percentage=33, samples=3006, conversions=180),
                ],
                "traffic_percentage": 100,
                "tags": ["voice", "ux"],
            },
            {
                "name": "Notification Grouping",
                "hypothesis": "Grouped notifications reduce dismiss rate",
                "type": ExperimentType.AB_TEST,
                "status": ExperimentStatus.RUNNING,
                "metric": "notification_engagement_rate",
                "variants": [
                    Variant(id="ctrl", name="Individual", is_control=True, traffic_percentage=50, samples=1090, conversions=436),
                    Variant(id="var_a", name="Grouped", traffic_percentage=50, samples=1090, conversions=491),
                ],
                "traffic_percentage": 30,
                "tags": ["notifications", "engagement"],
            },
            {
                "name": "Agent Response Format",
                "hypothesis": "Markdown-formatted responses improve comprehension",
                "type": ExperimentType.AB_TEST,
                "status": ExperimentStatus.PAUSED,
                "metric": "user_satisfaction_score",
                "variants": [
                    Variant(id="ctrl", name="Plain Text", is_control=True, traffic_percentage=50, samples=445, conversions=320),
                    Variant(id="var_a", name="Rich Markdown", traffic_percentage=50, samples=445, conversions=338),
                ],
                "traffic_percentage": 20,
                "tags": ["agents", "content"],
            },
            {
                "name": "Smart Home Auto-Scene",
                "hypothesis": "Predictive scene changes improve user comfort ratings",
                "type": ExperimentType.FEATURE_FLAG,
                "status": ExperimentStatus.COMPLETED,
                "metric": "comfort_survey_score",
                "variants": [
                    Variant(id="ctrl", name="Manual Scenes", is_control=True, traffic_percentage=50, samples=3350, conversions=2010),
                    Variant(id="var_a", name="Auto Scenes", traffic_percentage=50, samples=3350, conversions=2479),
                ],
                "traffic_percentage": 50,
                "tags": ["smart-home", "ml"],
            },
            {
                "name": "API Rate Limiting Strategy",
                "hypothesis": "Token bucket algorithm improves API throughput",
                "type": ExperimentType.CANARY,
                "status": ExperimentStatus.DRAFT,
                "metric": "request_success_rate",
                "variants": [
                    Variant(id="ctrl", name="Fixed Window", is_control=True, traffic_percentage=95),
                    Variant(id="var_a", name="Token Bucket", traffic_percentage=5),
                ],
                "traffic_percentage": 5,
                "tags": ["api", "performance"],
            },
        ]
        
        for exp_data in experiments_data:
            exp_id = str(uuid.uuid4())
            exp = Experiment(
                id=exp_id,
                name=exp_data["name"],
                hypothesis=exp_data["hypothesis"],
                type=exp_data["type"],
                status=exp_data["status"],
                metric=exp_data["metric"],
                variants=exp_data["variants"],
                traffic_percentage=exp_data["traffic_percentage"],
                tags=exp_data.get("tags", []),
                start_date=(datetime.utcnow() - timedelta(days=random.randint(3, 14))).isoformat() if exp_data["status"] != ExperimentStatus.DRAFT else None,
            )
            
            # Generate daily data for running/completed experiments
            if exp.status in (ExperimentStatus.RUNNING, ExperimentStatus.COMPLETED):
                days = random.randint(7, 14)
                for d in range(days):
                    date = (datetime.utcnow() - timedelta(days=days - d)).strftime("%Y-%m-%d")
                    daily = {"date": date}
                    for variant in exp.variants:
                        daily_samples = variant.samples // days + random.randint(-10, 10)
                        cr = variant.conversion_rate / 100
                        daily[f"{variant.id}_samples"] = max(0, daily_samples)
                        daily[f"{variant.id}_conversions"] = max(0, int(daily_samples * cr * (0.9 + random.random() * 0.2)))
                    exp.daily_data.append(daily)
                
                # Compute results
                exp.results = self._compute_results(exp)
            
            self.experiments[exp_id] = exp
    
    def _compute_results(self, experiment: Experiment) -> Dict[str, Any]:
        """Compute statistical results for an experiment."""
        if len(experiment.variants) < 2:
            return {"error": "Need at least 2 variants"}
        
        control = next((v for v in experiment.variants if v.is_control), experiment.variants[0])
        results = {"control": control.id, "comparisons": []}
        
        for variant in experiment.variants:
            if variant.id == control.id:
                continue
            
            # Frequentist test
            freq = self.stats_engine.z_test_proportions(
                control.conversions, control.samples,
                variant.conversions, variant.samples,
            )
            
            # Bayesian test
            bayes = self.stats_engine.bayesian_probability(
                control.conversions, control.samples,
                variant.conversions, variant.samples,
            )
            
            comparison = {
                "variant_id": variant.id,
                "variant_name": variant.name,
                "frequentist": freq,
                "bayesian": bayes,
                "samples": variant.samples,
                "conversions": variant.conversions,
                "conversion_rate": round(variant.conversion_rate, 2),
            }
            results["comparisons"].append(comparison)
        
        # Determine winner
        best = None
        best_confidence = 0
        for comp in results["comparisons"]:
            if comp["frequentist"]["is_significant"] and comp["frequentist"]["confidence"] > best_confidence:
                best = comp["variant_id"]
                best_confidence = comp["frequentist"]["confidence"]
        
        results["winner"] = best
        results["winner_confidence"] = round(best_confidence, 2) if best else None
        
        # Control stats
        results["control_conversion_rate"] = round(control.conversion_rate, 2)
        results["total_samples"] = sum(v.samples for v in experiment.variants)
        
        # Sample size recommendation
        if control.conversion_rate > 0:
            results["required_sample_size"] = self.stats_engine.required_sample_size(
                control.conversion_rate / 100,
                experiment.minimum_detectable_effect,
            )
        
        return results
    
    def create_experiment(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new experiment."""
        exp_id = str(uuid.uuid4())
        
        variants = []
        for i, v_data in enumerate(data.get("variants", [])):
            variant = Variant(
                id=v_data.get("id", f"var_{i}"),
                name=v_data["name"],
                description=v_data.get("description", ""),
                traffic_percentage=v_data.get("traffic_percentage", 50),
                is_control=v_data.get("is_control", i == 0),
                config=v_data.get("config", {}),
            )
            variants.append(variant)
        
        experiment = Experiment(
            id=exp_id,
            name=data["name"],
            hypothesis=data.get("hypothesis", ""),
            description=data.get("description", ""),
            type=ExperimentType(data.get("type", "a/b")),
            metric=data.get("metric", "conversion_rate"),
            variants=variants,
            traffic_percentage=data.get("traffic_percentage", 100),
            min_sample_size=data.get("min_sample_size", 1000),
            significance_level=data.get("significance_level", 0.05),
            minimum_detectable_effect=data.get("minimum_detectable_effect", 5.0),
            tags=data.get("tags", []),
            owner=data.get("owner", "admin"),
        )
        
        self.experiments[exp_id] = experiment
        return self._serialize_experiment(experiment)
    
    def start_experiment(self, experiment_id: str) -> Dict[str, Any]:
        exp = self.experiments.get(experiment_id)
        if not exp:
            return {"error": "Experiment not found"}
        if exp.status not in (ExperimentStatus.DRAFT, ExperimentStatus.PAUSED):
            return {"error": f"Cannot start experiment in {exp.status.value} status"}
        
        exp.status = ExperimentStatus.RUNNING
        exp.start_date = datetime.utcnow().isoformat()
        exp.updated_at = datetime.utcnow().isoformat()
        return self._serialize_experiment(exp)
    
    def pause_experiment(self, experiment_id: str) -> Dict[str, Any]:
        exp = self.experiments.get(experiment_id)
        if not exp:
            return {"error": "Experiment not found"}
        
        exp.status = ExperimentStatus.PAUSED
        exp.updated_at = datetime.utcnow().isoformat()
        return self._serialize_experiment(exp)
    
    def complete_experiment(self, experiment_id: str) -> Dict[str, Any]:
        exp = self.experiments.get(experiment_id)
        if not exp:
            return {"error": "Experiment not found"}
        
        exp.status = ExperimentStatus.COMPLETED
        exp.end_date = datetime.utcnow().isoformat()
        exp.updated_at = datetime.utcnow().isoformat()
        exp.results = self._compute_results(exp)
        return self._serialize_experiment(exp)
    
    def record_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Record an experiment event (exposure or conversion)."""
        exp_id = event["experiment_id"]
        exp = self.experiments.get(exp_id)
        if not exp or exp.status != ExperimentStatus.RUNNING:
            return {"success": False, "error": "Experiment not running"}
        
        variant_id = event.get("variant_id")
        user_id = event["user_id"]
        
        # Auto-assign variant if not specified
        if not variant_id:
            variant_id = self._assign_variant(exp, user_id)
        
        variant = next((v for v in exp.variants if v.id == variant_id), None)
        if not variant:
            return {"success": False, "error": "Variant not found"}
        
        event_type = event.get("event_type", "exposure")
        value = event.get("value", 1.0)
        
        if event_type == "exposure":
            variant.samples += 1
        elif event_type == "conversion":
            variant.conversions += 1
            variant.total_value += value
        
        exp_event = ExperimentEvent(
            experiment_id=exp_id,
            variant_id=variant_id,
            user_id=user_id,
            event_type=event_type,
            value=value,
            metadata=event.get("metadata", {}),
        )
        self.events.append(exp_event)
        
        # Recompute results periodically
        total_events = sum(v.samples for v in exp.variants)
        if total_events % 100 == 0:
            exp.results = self._compute_results(exp)
        
        return {"success": True, "variant_id": variant_id, "event_type": event_type}
    
    def _assign_variant(self, experiment: Experiment, user_id: str) -> str:
        """Assign a user to a variant deterministically."""
        key = f"{experiment.id}:{user_id}"
        
        # Check existing assignment
        if user_id in self.user_assignments and experiment.id in self.user_assignments[user_id]:
            return self.user_assignments[user_id][experiment.id]
        
        # Deterministic assignment based on hash
        import hashlib
        hash_val = int(hashlib.md5(key.encode()).hexdigest(), 16) % 10000
        
        cumulative = 0
        assigned = experiment.variants[-1].id
        for variant in experiment.variants:
            cumulative += variant.traffic_percentage * 100
            if hash_val < cumulative:
                assigned = variant.id
                break
        
        if user_id not in self.user_assignments:
            self.user_assignments[user_id] = {}
        self.user_assignments[user_id][experiment.id] = assigned
        
        return assigned
    
    def get_experiment(self, experiment_id: str) -> Optional[Dict[str, Any]]:
        exp = self.experiments.get(experiment_id)
        return self._serialize_experiment(exp) if exp else None
    
    def list_experiments(
        self,
        status: Optional[ExperimentStatus] = None,
        type_filter: Optional[ExperimentType] = None,
    ) -> List[Dict[str, Any]]:
        experiments = list(self.experiments.values())
        if status:
            experiments = [e for e in experiments if e.status == status]
        if type_filter:
            experiments = [e for e in experiments if e.type == type_filter]
        
        return [self._serialize_experiment(e) for e in experiments]
    
    def get_results(self, experiment_id: str) -> Optional[Dict[str, Any]]:
        exp = self.experiments.get(experiment_id)
        if not exp:
            return None
        
        if not exp.results or exp.status == ExperimentStatus.RUNNING:
            exp.results = self._compute_results(exp)
        
        return {
            "experiment_id": exp.id,
            "experiment_name": exp.name,
            "status": exp.status.value,
            "results": exp.results,
            "daily_data": exp.daily_data,
        }
    
    def get_stats(self) -> Dict[str, Any]:
        by_status: Dict[str, int] = defaultdict(int)
        by_type: Dict[str, int] = defaultdict(int)
        total_samples = 0
        total_conversions = 0
        
        for exp in self.experiments.values():
            by_status[exp.status.value] += 1
            by_type[exp.type.value] += 1
            for v in exp.variants:
                total_samples += v.samples
                total_conversions += v.conversions
        
        return {
            "total_experiments": len(self.experiments),
            "by_status": dict(by_status),
            "by_type": dict(by_type),
            "total_samples": total_samples,
            "total_conversions": total_conversions,
            "total_events": len(self.events),
            "unique_users": len(self.user_assignments),
        }
    
    def _serialize_experiment(self, exp: Experiment) -> Dict[str, Any]:
        data = asdict(exp)
        data["type"] = exp.type.value
        data["status"] = exp.status.value
        for i, v in enumerate(data["variants"]):
            v["conversion_rate"] = round(exp.variants[i].conversion_rate, 2)
            v["mean_value"] = round(exp.variants[i].mean_value, 4)
        return data
    
    def delete_experiment(self, experiment_id: str) -> bool:
        if experiment_id in self.experiments:
            del self.experiments[experiment_id]
            return True
        return False


# Singleton
_experiment_service: Optional[ExperimentService] = None

def get_experiment_service() -> ExperimentService:
    global _experiment_service
    if _experiment_service is None:
        _experiment_service = ExperimentService()
    return _experiment_service
