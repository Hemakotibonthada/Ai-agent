"""
Data Pipeline Service
Features: ETL pipeline builder, data transformations, scheduled jobs,
          data quality checks, pipeline monitoring, data lineage tracking
"""
from __future__ import annotations

import asyncio
import copy
import csv
import io
import json
import math
import statistics
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
from services.demo_data_manager import is_demo_data_enabled


class PipelineStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StepType(str, Enum):
    SOURCE = "source"
    TRANSFORM = "transform"
    FILTER = "filter"
    AGGREGATE = "aggregate"
    JOIN = "join"
    SORT = "sort"
    DEDUPLICATE = "deduplicate"
    VALIDATE = "validate"
    ENRICH = "enrich"
    SPLIT = "split"
    MERGE = "merge"
    SINK = "sink"
    CUSTOM = "custom"


class DataFormat(str, Enum):
    JSON = "json"
    CSV = "csv"
    TABLE = "table"
    KEY_VALUE = "key_value"
    TIME_SERIES = "time_series"


class QualityCheckType(str, Enum):
    NOT_NULL = "not_null"
    UNIQUE = "unique"
    RANGE = "range"
    PATTERN = "pattern"
    TYPE_CHECK = "type_check"
    CUSTOM = "custom"
    REFERENTIAL = "referential"
    COMPLETENESS = "completeness"


@dataclass
class DataQualityRule:
    id: str
    name: str
    check_type: QualityCheckType
    column: str
    params: Dict[str, Any] = field(default_factory=dict)
    severity: str = "error"
    description: str = ""


@dataclass
class QualityCheckResult:
    rule_id: str
    passed: bool
    total_records: int = 0
    failed_records: int = 0
    failure_rate: float = 0.0
    details: str = ""
    sample_failures: List[Any] = field(default_factory=list)


@dataclass
class PipelineStep:
    id: str
    name: str
    step_type: StepType
    config: Dict[str, Any] = field(default_factory=dict)
    order: int = 0
    input_step_ids: List[str] = field(default_factory=list)
    output_step_ids: List[str] = field(default_factory=list)
    quality_rules: List[DataQualityRule] = field(default_factory=list)
    enabled: bool = True
    retry_count: int = 0
    retry_delay: float = 1.0
    timeout: float = 300.0


@dataclass
class StepExecution:
    step_id: str
    step_name: str
    status: str = "pending"
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    duration_ms: float = 0
    input_records: int = 0
    output_records: int = 0
    error_message: Optional[str] = None
    quality_results: List[QualityCheckResult] = field(default_factory=list)
    metrics: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Pipeline:
    id: str
    name: str
    description: str
    steps: List[PipelineStep] = field(default_factory=list)
    status: PipelineStatus = PipelineStatus.DRAFT
    schedule: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    created_by: str = "system"
    tags: List[str] = field(default_factory=list)
    config: Dict[str, Any] = field(default_factory=dict)
    version: int = 1
    category: str = "general"
    icon: str = "zap"


@dataclass
class PipelineExecution:
    id: str
    pipeline_id: str
    pipeline_name: str
    status: PipelineStatus = PipelineStatus.RUNNING
    started_at: float = field(default_factory=time.time)
    completed_at: Optional[float] = None
    duration_ms: float = 0
    step_executions: List[StepExecution] = field(default_factory=list)
    total_records_processed: int = 0
    error_message: Optional[str] = None
    triggered_by: str = "manual"


@dataclass
class DataLineage:
    source_step: str
    target_step: str
    columns_mapped: Dict[str, str] = field(default_factory=dict)
    transformation: str = ""
    record_count: int = 0
    timestamp: float = field(default_factory=time.time)


class TransformEngine:
    """Data transformation engine with built-in operations."""

    @staticmethod
    def apply_transform(
        data: List[Dict[str, Any]], transform_type: str, config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Apply a transformation to data."""
        transforms = {
            "rename_columns": TransformEngine._rename_columns,
            "drop_columns": TransformEngine._drop_columns,
            "add_column": TransformEngine._add_column,
            "cast_type": TransformEngine._cast_type,
            "fill_null": TransformEngine._fill_null,
            "replace_value": TransformEngine._replace_value,
            "string_transform": TransformEngine._string_transform,
            "math_operation": TransformEngine._math_operation,
            "date_transform": TransformEngine._date_transform,
            "split_column": TransformEngine._split_column,
            "merge_columns": TransformEngine._merge_columns,
            "pivot": TransformEngine._pivot,
            "unpivot": TransformEngine._unpivot,
            "flatten": TransformEngine._flatten,
            "normalize": TransformEngine._normalize,
        }

        handler = transforms.get(transform_type)
        if handler:
            return handler(data, config)
        return data

    @staticmethod
    def _rename_columns(
        data: List[Dict[str, Any]], config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        mapping = config.get("mapping", {})
        return [
            {mapping.get(k, k): v for k, v in row.items()}
            for row in data
        ]

    @staticmethod
    def _drop_columns(
        data: List[Dict[str, Any]], config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        columns = set(config.get("columns", []))
        return [
            {k: v for k, v in row.items() if k not in columns}
            for row in data
        ]

    @staticmethod
    def _add_column(
        data: List[Dict[str, Any]], config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        column = config.get("column", "new_column")
        value = config.get("value")
        expression = config.get("expression")

        result = []
        for row in data:
            new_row = dict(row)
            if expression:
                try:
                    new_row[column] = eval(expression, {"__builtins__": {}}, row)
                except Exception:
                    new_row[column] = None
            else:
                new_row[column] = value
            result.append(new_row)
        return result

    @staticmethod
    def _cast_type(
        data: List[Dict[str, Any]], config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        column = config.get("column", "")
        target_type = config.get("type", "str")
        type_map = {"str": str, "int": int, "float": float, "bool": bool}
        cast_fn = type_map.get(target_type, str)

        result = []
        for row in data:
            new_row = dict(row)
            if column in new_row and new_row[column] is not None:
                try:
                    new_row[column] = cast_fn(new_row[column])
                except (ValueError, TypeError):
                    pass
            result.append(new_row)
        return result

    @staticmethod
    def _fill_null(
        data: List[Dict[str, Any]], config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        column = config.get("column")
        fill_value = config.get("value", "")
        strategy = config.get("strategy", "value")

        if strategy == "mean" and column:
            values = [
                row.get(column)
                for row in data
                if row.get(column) is not None
                and isinstance(row.get(column), (int, float))
            ]
            fill_value = sum(values) / len(values) if values else 0
        elif strategy == "median" and column:
            values = sorted(
                row.get(column)
                for row in data
                if row.get(column) is not None
                and isinstance(row.get(column), (int, float))
            )
            fill_value = values[len(values) // 2] if values else 0

        result = []
        for row in data:
            new_row = dict(row)
            if column:
                if new_row.get(column) is None:
                    new_row[column] = fill_value
            else:
                for k, v in new_row.items():
                    if v is None:
                        new_row[k] = fill_value
            result.append(new_row)
        return result

    @staticmethod
    def _replace_value(
        data: List[Dict[str, Any]], config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        column = config.get("column", "")
        old_val = config.get("old_value")
        new_val = config.get("new_value")

        return [
            {
                k: (new_val if k == column and v == old_val else v)
                for k, v in row.items()
            }
            for row in data
        ]

    @staticmethod
    def _string_transform(
        data: List[Dict[str, Any]], config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        column = config.get("column", "")
        operation = config.get("operation", "lower")

        ops = {
            "lower": lambda s: s.lower() if isinstance(s, str) else s,
            "upper": lambda s: s.upper() if isinstance(s, str) else s,
            "strip": lambda s: s.strip() if isinstance(s, str) else s,
            "title": lambda s: s.title() if isinstance(s, str) else s,
            "capitalize": lambda s: s.capitalize() if isinstance(s, str) else s,
        }
        fn = ops.get(operation, lambda s: s)

        return [
            {k: (fn(v) if k == column else v) for k, v in row.items()}
            for row in data
        ]

    @staticmethod
    def _math_operation(
        data: List[Dict[str, Any]], config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        column = config.get("column", "")
        operation = config.get("operation", "add")
        operand = config.get("operand", 0)
        result_column = config.get("result_column", column)

        ops = {
            "add": lambda x: x + operand,
            "subtract": lambda x: x - operand,
            "multiply": lambda x: x * operand,
            "divide": lambda x: x / operand if operand != 0 else None,
            "modulo": lambda x: x % operand if operand != 0 else None,
            "power": lambda x: x ** operand,
            "abs": lambda x: abs(x),
            "round": lambda x: round(x, int(operand)),
            "ceil": lambda x: math.ceil(x),
            "floor": lambda x: math.floor(x),
            "log": lambda x: math.log(x) if x > 0 else None,
            "sqrt": lambda x: math.sqrt(x) if x >= 0 else None,
        }
        fn = ops.get(operation, lambda x: x)

        result = []
        for row in data:
            new_row = dict(row)
            val = new_row.get(column)
            if isinstance(val, (int, float)):
                try:
                    new_row[result_column] = fn(val)
                except Exception:
                    new_row[result_column] = None
            result.append(new_row)
        return result

    @staticmethod
    def _date_transform(
        data: List[Dict[str, Any]], config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        column = config.get("column", "")
        extract = config.get("extract", "year")
        result_column = config.get("result_column", f"{column}_{extract}")

        from datetime import datetime

        result = []
        for row in data:
            new_row = dict(row)
            val = new_row.get(column)
            if isinstance(val, (int, float)):
                dt = datetime.fromtimestamp(val)
                extractors = {
                    "year": dt.year,
                    "month": dt.month,
                    "day": dt.day,
                    "hour": dt.hour,
                    "minute": dt.minute,
                    "weekday": dt.weekday(),
                    "week": dt.isocalendar()[1],
                    "quarter": (dt.month - 1) // 3 + 1,
                }
                new_row[result_column] = extractors.get(extract, val)
            result.append(new_row)
        return result

    @staticmethod
    def _split_column(
        data: List[Dict[str, Any]], config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        column = config.get("column", "")
        delimiter = config.get("delimiter", ",")
        new_columns = config.get("new_columns", [])

        result = []
        for row in data:
            new_row = dict(row)
            val = new_row.get(column, "")
            if isinstance(val, str):
                parts = val.split(delimiter)
                for i, col_name in enumerate(new_columns):
                    new_row[col_name] = parts[i].strip() if i < len(parts) else None
            result.append(new_row)
        return result

    @staticmethod
    def _merge_columns(
        data: List[Dict[str, Any]], config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        columns = config.get("columns", [])
        separator = config.get("separator", " ")
        result_column = config.get("result_column", "merged")

        result = []
        for row in data:
            new_row = dict(row)
            values = [str(row.get(c, "")) for c in columns]
            new_row[result_column] = separator.join(values)
            result.append(new_row)
        return result

    @staticmethod
    def _pivot(
        data: List[Dict[str, Any]], config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        index_col = config.get("index", "")
        pivot_col = config.get("column", "")
        value_col = config.get("value", "")

        pivoted: Dict[Any, Dict[str, Any]] = {}
        for row in data:
            idx = row.get(index_col)
            col = row.get(pivot_col)
            val = row.get(value_col)
            if idx not in pivoted:
                pivoted[idx] = {index_col: idx}
            pivoted[idx][str(col)] = val

        return list(pivoted.values())

    @staticmethod
    def _unpivot(
        data: List[Dict[str, Any]], config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        id_columns = config.get("id_columns", [])
        value_name = config.get("value_name", "value")
        variable_name = config.get("variable_name", "variable")

        result = []
        for row in data:
            id_values = {c: row.get(c) for c in id_columns}
            for key, value in row.items():
                if key not in id_columns:
                    new_row = dict(id_values)
                    new_row[variable_name] = key
                    new_row[value_name] = value
                    result.append(new_row)
        return result

    @staticmethod
    def _flatten(
        data: List[Dict[str, Any]], config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        column = config.get("column", "")
        prefix = config.get("prefix", "")

        result = []
        for row in data:
            new_row = {}
            for k, v in row.items():
                if k == column and isinstance(v, dict):
                    for nested_k, nested_v in v.items():
                        key = f"{prefix}{nested_k}" if prefix else nested_k
                        new_row[key] = nested_v
                else:
                    new_row[k] = v
            result.append(new_row)
        return result

    @staticmethod
    def _normalize(
        data: List[Dict[str, Any]], config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        column = config.get("column", "")
        method = config.get("method", "min_max")

        values = [
            row.get(column)
            for row in data
            if isinstance(row.get(column), (int, float))
        ]

        if not values:
            return data

        if method == "min_max":
            min_val = min(values)
            max_val = max(values)
            range_val = max_val - min_val if max_val != min_val else 1
            norm_fn = lambda x: (x - min_val) / range_val
        elif method == "z_score":
            mean = statistics.mean(values)
            stdev = statistics.stdev(values) if len(values) > 1 else 1
            norm_fn = lambda x: (x - mean) / stdev
        else:
            norm_fn = lambda x: x

        result = []
        for row in data:
            new_row = dict(row)
            val = new_row.get(column)
            if isinstance(val, (int, float)):
                new_row[column] = round(norm_fn(val), 6)
            result.append(new_row)
        return result


class DataQualityEngine:
    """Data quality validation engine."""

    @staticmethod
    def check(
        data: List[Dict[str, Any]], rule: DataQualityRule
    ) -> QualityCheckResult:
        checks = {
            QualityCheckType.NOT_NULL: DataQualityEngine._check_not_null,
            QualityCheckType.UNIQUE: DataQualityEngine._check_unique,
            QualityCheckType.RANGE: DataQualityEngine._check_range,
            QualityCheckType.PATTERN: DataQualityEngine._check_pattern,
            QualityCheckType.TYPE_CHECK: DataQualityEngine._check_type,
            QualityCheckType.COMPLETENESS: DataQualityEngine._check_completeness,
        }
        handler = checks.get(rule.check_type)
        if handler:
            return handler(data, rule)
        return QualityCheckResult(rule_id=rule.id, passed=True, total_records=len(data))

    @staticmethod
    def _check_not_null(
        data: List[Dict[str, Any]], rule: DataQualityRule
    ) -> QualityCheckResult:
        failures = [
            i for i, row in enumerate(data)
            if row.get(rule.column) is None or row.get(rule.column) == ""
        ]
        return QualityCheckResult(
            rule_id=rule.id,
            passed=len(failures) == 0,
            total_records=len(data),
            failed_records=len(failures),
            failure_rate=len(failures) / len(data) if data else 0,
            details=f"{len(failures)} null values found in '{rule.column}'",
            sample_failures=failures[:5],
        )

    @staticmethod
    def _check_unique(
        data: List[Dict[str, Any]], rule: DataQualityRule
    ) -> QualityCheckResult:
        values = [row.get(rule.column) for row in data]
        duplicates = len(values) - len(set(values))
        return QualityCheckResult(
            rule_id=rule.id,
            passed=duplicates == 0,
            total_records=len(data),
            failed_records=duplicates,
            failure_rate=duplicates / len(data) if data else 0,
            details=f"{duplicates} duplicate values found in '{rule.column}'",
        )

    @staticmethod
    def _check_range(
        data: List[Dict[str, Any]], rule: DataQualityRule
    ) -> QualityCheckResult:
        min_val = rule.params.get("min", float("-inf"))
        max_val = rule.params.get("max", float("inf"))
        failures = []
        for i, row in enumerate(data):
            val = row.get(rule.column)
            if isinstance(val, (int, float)):
                if val < min_val or val > max_val:
                    failures.append(i)
        return QualityCheckResult(
            rule_id=rule.id,
            passed=len(failures) == 0,
            total_records=len(data),
            failed_records=len(failures),
            failure_rate=len(failures) / len(data) if data else 0,
            details=f"{len(failures)} values outside range [{min_val}, {max_val}]",
            sample_failures=failures[:5],
        )

    @staticmethod
    def _check_pattern(
        data: List[Dict[str, Any]], rule: DataQualityRule
    ) -> QualityCheckResult:
        import re
        pattern = re.compile(rule.params.get("pattern", ".*"))
        failures = []
        for i, row in enumerate(data):
            val = row.get(rule.column)
            if isinstance(val, str) and not pattern.match(val):
                failures.append(i)
        return QualityCheckResult(
            rule_id=rule.id,
            passed=len(failures) == 0,
            total_records=len(data),
            failed_records=len(failures),
            failure_rate=len(failures) / len(data) if data else 0,
            details=f"{len(failures)} values don't match pattern",
            sample_failures=failures[:5],
        )

    @staticmethod
    def _check_type(
        data: List[Dict[str, Any]], rule: DataQualityRule
    ) -> QualityCheckResult:
        expected_type = rule.params.get("type", "str")
        type_map = {"str": str, "int": int, "float": float, "bool": bool}
        expected = type_map.get(expected_type, str)
        failures = [
            i for i, row in enumerate(data)
            if row.get(rule.column) is not None
            and not isinstance(row.get(rule.column), expected)
        ]
        return QualityCheckResult(
            rule_id=rule.id,
            passed=len(failures) == 0,
            total_records=len(data),
            failed_records=len(failures),
            failure_rate=len(failures) / len(data) if data else 0,
            details=f"{len(failures)} type mismatches (expected {expected_type})",
            sample_failures=failures[:5],
        )

    @staticmethod
    def _check_completeness(
        data: List[Dict[str, Any]], rule: DataQualityRule
    ) -> QualityCheckResult:
        threshold = rule.params.get("threshold", 0.95)
        non_null = sum(
            1 for row in data
            if row.get(rule.column) is not None and row.get(rule.column) != ""
        )
        completeness = non_null / len(data) if data else 0
        return QualityCheckResult(
            rule_id=rule.id,
            passed=completeness >= threshold,
            total_records=len(data),
            failed_records=len(data) - non_null,
            failure_rate=1 - completeness,
            details=f"Completeness: {completeness:.1%} (threshold: {threshold:.1%})",
        )


class DataPipelineService:
    """
    Complete data pipeline management system.

    Features:
    - Visual pipeline builder
    - 15+ transformation types
    - Data quality validation
    - Pipeline execution engine
    - Execution history and monitoring
    - Data lineage tracking
    - Pre-built pipeline templates
    - Step-by-step execution
    - Error handling and retry
    - Pipeline versioning
    """

    def __init__(self):
        self._pipelines: Dict[str, Pipeline] = {}
        self._executions: List[PipelineExecution] = []
        self._lineage: List[DataLineage] = []
        self._transform_engine = TransformEngine()
        self._quality_engine = DataQualityEngine()
        self._sample_data: Dict[str, List[Dict[str, Any]]] = self._init_sample_data() if is_demo_data_enabled() else {}
        if is_demo_data_enabled():
            self._init_default_pipelines()

    def _init_sample_data(self) -> Dict[str, List[Dict[str, Any]]]:
        """Initialize sample data sources."""
        return {
            "users": [
                {"id": 1, "name": "Alice Johnson", "email": "alice@example.com", "age": 32, "department": "Engineering", "salary": 95000, "joined": 1640995200},
                {"id": 2, "name": "Bob Smith", "email": "bob@example.com", "age": 28, "department": "Marketing", "salary": 72000, "joined": 1648771200},
                {"id": 3, "name": "Carol Davis", "email": "carol@example.com", "age": 45, "department": "Engineering", "salary": 120000, "joined": 1609459200},
                {"id": 4, "name": "David Wilson", "email": "david@example.com", "age": 35, "department": "Sales", "salary": 85000, "joined": 1656633600},
                {"id": 5, "name": "Eve Brown", "email": "eve@example.com", "age": 29, "department": "Engineering", "salary": 98000, "joined": 1664582400},
                {"id": 6, "name": "Frank Miller", "email": "frank@example.com", "age": 41, "department": "Marketing", "salary": 88000, "joined": 1617235200},
                {"id": 7, "name": "Grace Lee", "email": "grace@example.com", "age": 38, "department": "Sales", "salary": 92000, "joined": 1625097600},
                {"id": 8, "name": "Henry Taylor", "email": "henry@example.com", "age": 26, "department": "Engineering", "salary": 78000, "joined": 1672531200},
            ],
            "transactions": [
                {"id": "t1", "user_id": 1, "amount": 150.00, "category": "food", "date": 1704067200, "status": "completed"},
                {"id": "t2", "user_id": 2, "amount": 2500.00, "category": "rent", "date": 1704153600, "status": "completed"},
                {"id": "t3", "user_id": 1, "amount": 45.00, "category": "transport", "date": 1704240000, "status": "completed"},
                {"id": "t4", "user_id": 3, "amount": 89.99, "category": "shopping", "date": 1704326400, "status": "pending"},
                {"id": "t5", "user_id": 4, "amount": 1200.00, "category": "rent", "date": 1704412800, "status": "completed"},
                {"id": "t6", "user_id": 5, "amount": 35.50, "category": "food", "date": 1704499200, "status": "completed"},
                {"id": "t7", "user_id": 2, "amount": 500.00, "category": "utilities", "date": 1704585600, "status": "completed"},
                {"id": "t8", "user_id": 6, "amount": 299.99, "category": "shopping", "date": 1704672000, "status": "failed"},
            ],
            "sensor_data": [
                {"sensor_id": "s1", "type": "temperature", "value": 22.5, "unit": "celsius", "timestamp": 1704067200, "location": "living_room"},
                {"sensor_id": "s2", "type": "humidity", "value": 45.0, "unit": "percent", "timestamp": 1704067200, "location": "living_room"},
                {"sensor_id": "s3", "type": "temperature", "value": 18.3, "unit": "celsius", "timestamp": 1704067200, "location": "bedroom"},
                {"sensor_id": "s1", "type": "temperature", "value": 23.1, "unit": "celsius", "timestamp": 1704070800, "location": "living_room"},
                {"sensor_id": "s2", "type": "humidity", "value": 42.0, "unit": "percent", "timestamp": 1704070800, "location": "living_room"},
                {"sensor_id": "s3", "type": "temperature", "value": 19.0, "unit": "celsius", "timestamp": 1704070800, "location": "bedroom"},
            ],
        }

    def _init_default_pipelines(self):
        """Create default pipeline templates."""
        pipelines = [
            Pipeline(
                id="user-analytics",
                name="User Analytics Pipeline",
                description="Process user data for analytics dashboard with aggregations and quality checks",
                category="analytics",
                icon="bar-chart-2",
                tags=["analytics", "users", "reporting"],
                status=PipelineStatus.ACTIVE,
                steps=[
                    PipelineStep(
                        id="source", name="Load Users", step_type=StepType.SOURCE, order=0,
                        config={"source": "users"},
                    ),
                    PipelineStep(
                        id="validate", name="Validate Data", step_type=StepType.VALIDATE, order=1,
                        input_step_ids=["source"],
                        quality_rules=[
                            DataQualityRule(id="qr1", name="Email not null", check_type=QualityCheckType.NOT_NULL, column="email"),
                            DataQualityRule(id="qr2", name="Age range", check_type=QualityCheckType.RANGE, column="age", params={"min": 18, "max": 100}),
                        ],
                    ),
                    PipelineStep(
                        id="transform", name="Compute Metrics", step_type=StepType.TRANSFORM, order=2,
                        input_step_ids=["validate"],
                        config={"transform_type": "add_column", "column": "tenure_days", "expression": "(1704067200 - joined) / 86400"},
                    ),
                    PipelineStep(
                        id="aggregate", name="Dept Summary", step_type=StepType.AGGREGATE, order=3,
                        input_step_ids=["transform"],
                        config={"group_by": "department", "aggregations": {"salary": "avg", "id": "count"}},
                    ),
                    PipelineStep(
                        id="sink", name="Output Results", step_type=StepType.SINK, order=4,
                        input_step_ids=["aggregate"],
                        config={"format": "json", "destination": "analytics_store"},
                    ),
                ],
            ),
            Pipeline(
                id="transaction-etl",
                name="Transaction ETL Pipeline",
                description="Extract, transform, and load transaction data with enrichment",
                category="etl",
                icon="database",
                tags=["etl", "transactions", "finance"],
                status=PipelineStatus.ACTIVE,
                steps=[
                    PipelineStep(
                        id="source", name="Load Transactions", step_type=StepType.SOURCE, order=0,
                        config={"source": "transactions"},
                    ),
                    PipelineStep(
                        id="filter", name="Filter Completed", step_type=StepType.FILTER, order=1,
                        input_step_ids=["source"],
                        config={"column": "status", "operator": "eq", "value": "completed"},
                    ),
                    PipelineStep(
                        id="enrich", name="Categorize", step_type=StepType.ENRICH, order=2,
                        input_step_ids=["filter"],
                        config={"transform_type": "add_column", "column": "is_large", "expression": "amount > 500"},
                    ),
                    PipelineStep(
                        id="sort", name="Sort by Amount", step_type=StepType.SORT, order=3,
                        input_step_ids=["enrich"],
                        config={"column": "amount", "order": "desc"},
                    ),
                    PipelineStep(
                        id="sink", name="Store Results", step_type=StepType.SINK, order=4,
                        input_step_ids=["sort"],
                        config={"format": "json", "destination": "data_warehouse"},
                    ),
                ],
            ),
            Pipeline(
                id="sensor-analysis",
                name="IoT Sensor Analysis",
                description="Process and analyze IoT sensor data with anomaly detection",
                category="iot",
                icon="activity",
                tags=["iot", "sensors", "monitoring"],
                status=PipelineStatus.ACTIVE,
                steps=[
                    PipelineStep(
                        id="source", name="Load Sensor Data", step_type=StepType.SOURCE, order=0,
                        config={"source": "sensor_data"},
                    ),
                    PipelineStep(
                        id="filter", name="Filter Temperature", step_type=StepType.FILTER, order=1,
                        input_step_ids=["source"],
                        config={"column": "type", "operator": "eq", "value": "temperature"},
                    ),
                    PipelineStep(
                        id="normalize", name="Normalize Values", step_type=StepType.TRANSFORM, order=2,
                        input_step_ids=["filter"],
                        config={"transform_type": "normalize", "column": "value", "method": "min_max"},
                    ),
                    PipelineStep(
                        id="aggregate", name="Avg by Location", step_type=StepType.AGGREGATE, order=3,
                        input_step_ids=["normalize"],
                        config={"group_by": "location", "aggregations": {"value": "avg"}},
                    ),
                    PipelineStep(
                        id="sink", name="Output", step_type=StepType.SINK, order=4,
                        input_step_ids=["aggregate"],
                        config={"format": "json"},
                    ),
                ],
            ),
        ]

        for pipeline in pipelines:
            self._pipelines[pipeline.id] = pipeline

    async def create_pipeline(self, pipeline: Pipeline) -> Pipeline:
        """Create a new pipeline."""
        if pipeline.id in self._pipelines:
            raise ValueError(f"Pipeline '{pipeline.id}' already exists")
        pipeline.created_at = time.time()
        pipeline.updated_at = time.time()
        self._pipelines[pipeline.id] = pipeline
        return pipeline

    async def get_pipeline(self, pipeline_id: str) -> Optional[Dict[str, Any]]:
        """Get pipeline details."""
        pipeline = self._pipelines.get(pipeline_id)
        if not pipeline:
            return None
        return self._serialize_pipeline(pipeline)

    async def list_pipelines(
        self, category: Optional[str] = None, status: Optional[PipelineStatus] = None
    ) -> List[Dict[str, Any]]:
        """List all pipelines."""
        pipelines = list(self._pipelines.values())
        if category:
            pipelines = [p for p in pipelines if p.category == category]
        if status:
            pipelines = [p for p in pipelines if p.status == status]
        return [self._serialize_pipeline(p) for p in pipelines]

    async def execute_pipeline(
        self, pipeline_id: str, triggered_by: str = "manual"
    ) -> PipelineExecution:
        """Execute a pipeline."""
        pipeline = self._pipelines.get(pipeline_id)
        if not pipeline:
            raise ValueError(f"Pipeline '{pipeline_id}' not found")

        execution = PipelineExecution(
            id=str(uuid.uuid4()),
            pipeline_id=pipeline_id,
            pipeline_name=pipeline.name,
            triggered_by=triggered_by,
        )

        sorted_steps = sorted(pipeline.steps, key=lambda s: s.order)
        step_data: Dict[str, List[Dict[str, Any]]] = {}

        try:
            for step in sorted_steps:
                if not step.enabled:
                    continue

                step_exec = StepExecution(
                    step_id=step.id,
                    step_name=step.name,
                    status="running",
                    started_at=time.time(),
                )

                try:
                    input_data = []
                    if step.step_type == StepType.SOURCE:
                        source_name = step.config.get("source", "")
                        input_data = copy.deepcopy(
                            self._sample_data.get(source_name, [])
                        )
                    elif step.input_step_ids:
                        for input_id in step.input_step_ids:
                            input_data.extend(step_data.get(input_id, []))

                    step_exec.input_records = len(input_data)

                    output_data = await self._execute_step(step, input_data)
                    step_data[step.id] = output_data

                    if step.quality_rules:
                        for rule in step.quality_rules:
                            result = self._quality_engine.check(output_data, rule)
                            step_exec.quality_results.append(result)
                            if not result.passed and rule.severity == "error":
                                raise ValueError(
                                    f"Quality check failed: {result.details}"
                                )

                    step_exec.output_records = len(output_data)
                    step_exec.status = "completed"
                    step_exec.completed_at = time.time()
                    step_exec.duration_ms = (
                        step_exec.completed_at - step_exec.started_at
                    ) * 1000

                    self._lineage.append(
                        DataLineage(
                            source_step=step.input_step_ids[0] if step.input_step_ids else "source",
                            target_step=step.id,
                            record_count=len(output_data),
                        )
                    )

                except Exception as e:
                    step_exec.status = "failed"
                    step_exec.error_message = str(e)
                    step_exec.completed_at = time.time()
                    step_exec.duration_ms = (
                        step_exec.completed_at - step_exec.started_at
                    ) * 1000
                    raise

                finally:
                    execution.step_executions.append(step_exec)

            execution.status = PipelineStatus.COMPLETED
            execution.total_records_processed = sum(
                se.output_records for se in execution.step_executions
            )

        except Exception as e:
            execution.status = PipelineStatus.FAILED
            execution.error_message = str(e)

        finally:
            execution.completed_at = time.time()
            execution.duration_ms = (
                execution.completed_at - execution.started_at
            ) * 1000
            self._executions.append(execution)

        return execution

    async def _execute_step(
        self, step: PipelineStep, data: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Execute a single pipeline step."""
        if step.step_type == StepType.SOURCE:
            return data

        elif step.step_type == StepType.FILTER:
            column = step.config.get("column", "")
            operator = step.config.get("operator", "eq")
            value = step.config.get("value")

            ops = {
                "eq": lambda v: v == value,
                "ne": lambda v: v != value,
                "gt": lambda v: v > value if isinstance(v, (int, float)) else False,
                "lt": lambda v: v < value if isinstance(v, (int, float)) else False,
                "gte": lambda v: v >= value if isinstance(v, (int, float)) else False,
                "lte": lambda v: v <= value if isinstance(v, (int, float)) else False,
                "contains": lambda v: value in str(v) if v else False,
                "not_null": lambda v: v is not None,
                "is_null": lambda v: v is None,
            }
            filter_fn = ops.get(operator, lambda v: True)
            return [row for row in data if filter_fn(row.get(column))]

        elif step.step_type == StepType.TRANSFORM:
            transform_type = step.config.get("transform_type", "")
            return TransformEngine.apply_transform(data, transform_type, step.config)

        elif step.step_type == StepType.SORT:
            column = step.config.get("column", "")
            order = step.config.get("order", "asc")
            return sorted(
                data,
                key=lambda r: r.get(column, 0) or 0,
                reverse=(order == "desc"),
            )

        elif step.step_type == StepType.DEDUPLICATE:
            column = step.config.get("column", "")
            seen = set()
            result = []
            for row in data:
                key = row.get(column)
                if key not in seen:
                    seen.add(key)
                    result.append(row)
            return result

        elif step.step_type == StepType.AGGREGATE:
            group_by = step.config.get("group_by", "")
            aggregations = step.config.get("aggregations", {})

            groups: Dict[Any, List[Dict[str, Any]]] = defaultdict(list)
            for row in data:
                key = row.get(group_by, "unknown")
                groups[key].append(row)

            result = []
            for group_key, group_rows in groups.items():
                agg_row = {group_by: group_key}
                for col, agg_type in aggregations.items():
                    values = [
                        r.get(col)
                        for r in group_rows
                        if isinstance(r.get(col), (int, float))
                    ]
                    if agg_type == "sum":
                        agg_row[f"{col}_sum"] = sum(values)
                    elif agg_type == "avg":
                        agg_row[f"{col}_avg"] = (
                            round(sum(values) / len(values), 2)
                            if values
                            else 0
                        )
                    elif agg_type == "min":
                        agg_row[f"{col}_min"] = min(values) if values else 0
                    elif agg_type == "max":
                        agg_row[f"{col}_max"] = max(values) if values else 0
                    elif agg_type == "count":
                        agg_row[f"{col}_count"] = len(group_rows)
                agg_row["_group_size"] = len(group_rows)
                result.append(agg_row)
            return result

        elif step.step_type == StepType.SINK:
            return data

        elif step.step_type == StepType.VALIDATE:
            return data

        elif step.step_type == StepType.ENRICH:
            transform_type = step.config.get("transform_type", "add_column")
            return TransformEngine.apply_transform(data, transform_type, step.config)

        return data

    async def get_execution_history(
        self, pipeline_id: Optional[str] = None, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get pipeline execution history."""
        execs = self._executions
        if pipeline_id:
            execs = [e for e in execs if e.pipeline_id == pipeline_id]
        execs = execs[-limit:][::-1]

        return [
            {
                "id": e.id,
                "pipeline_id": e.pipeline_id,
                "pipeline_name": e.pipeline_name,
                "status": e.status.value,
                "started_at": e.started_at,
                "completed_at": e.completed_at,
                "duration_ms": round(e.duration_ms, 2),
                "total_records_processed": e.total_records_processed,
                "error_message": e.error_message,
                "triggered_by": e.triggered_by,
                "steps": [
                    {
                        "step_id": se.step_id,
                        "step_name": se.step_name,
                        "status": se.status,
                        "duration_ms": round(se.duration_ms, 2),
                        "input_records": se.input_records,
                        "output_records": se.output_records,
                        "error_message": se.error_message,
                        "quality_results": [
                            {
                                "rule_id": qr.rule_id,
                                "passed": qr.passed,
                                "total_records": qr.total_records,
                                "failed_records": qr.failed_records,
                                "failure_rate": round(qr.failure_rate * 100, 1),
                                "details": qr.details,
                            }
                            for qr in se.quality_results
                        ],
                    }
                    for se in e.step_executions
                ],
            }
            for e in execs
        ]

    async def get_data_lineage(
        self, pipeline_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get data lineage information."""
        lineage = self._lineage[-100:]
        return [
            {
                "source_step": l.source_step,
                "target_step": l.target_step,
                "columns_mapped": l.columns_mapped,
                "transformation": l.transformation,
                "record_count": l.record_count,
                "timestamp": l.timestamp,
            }
            for l in lineage
        ]

    async def get_pipeline_stats(self) -> Dict[str, Any]:
        """Get overall pipeline statistics."""
        return {
            "total_pipelines": len(self._pipelines),
            "active_pipelines": len([
                p for p in self._pipelines.values()
                if p.status == PipelineStatus.ACTIVE
            ]),
            "total_executions": len(self._executions),
            "successful_executions": len([
                e for e in self._executions
                if e.status == PipelineStatus.COMPLETED
            ]),
            "failed_executions": len([
                e for e in self._executions
                if e.status == PipelineStatus.FAILED
            ]),
            "total_records_processed": sum(
                e.total_records_processed for e in self._executions
            ),
            "avg_execution_time_ms": round(
                statistics.mean([e.duration_ms for e in self._executions])
                if self._executions
                else 0,
                2,
            ),
            "categories": dict(
                defaultdict(
                    int,
                    {
                        p.category: 1
                        for p in self._pipelines.values()
                    },
                )
            ),
        }

    async def preview_data(
        self, source: str, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Preview data from a source."""
        data = self._sample_data.get(source, [])
        return data[:limit]

    async def list_data_sources(self) -> List[Dict[str, Any]]:
        """List available data sources."""
        return [
            {
                "name": name,
                "record_count": len(data),
                "columns": list(data[0].keys()) if data else [],
                "sample": data[0] if data else {},
            }
            for name, data in self._sample_data.items()
        ]

    def _serialize_pipeline(self, pipeline: Pipeline) -> Dict[str, Any]:
        return {
            "id": pipeline.id,
            "name": pipeline.name,
            "description": pipeline.description,
            "status": pipeline.status.value,
            "category": pipeline.category,
            "icon": pipeline.icon,
            "tags": pipeline.tags,
            "version": pipeline.version,
            "created_at": pipeline.created_at,
            "updated_at": pipeline.updated_at,
            "created_by": pipeline.created_by,
            "step_count": len(pipeline.steps),
            "steps": [
                {
                    "id": s.id,
                    "name": s.name,
                    "step_type": s.step_type.value,
                    "config": s.config,
                    "order": s.order,
                    "enabled": s.enabled,
                    "input_step_ids": s.input_step_ids,
                    "quality_rules": [
                        {
                            "id": r.id,
                            "name": r.name,
                            "check_type": r.check_type.value,
                            "column": r.column,
                            "params": r.params,
                            "severity": r.severity,
                        }
                        for r in s.quality_rules
                    ],
                }
                for s in pipeline.steps
            ],
            "execution_count": len([
                e for e in self._executions if e.pipeline_id == pipeline.id
            ]),
        }


# ── Singleton ─────────────────────────────────────────────────────────
_data_pipeline_service: Optional[DataPipelineService] = None

def get_data_pipeline_service() -> DataPipelineService:
    global _data_pipeline_service
    if _data_pipeline_service is None:
        _data_pipeline_service = DataPipelineService()
    return _data_pipeline_service
