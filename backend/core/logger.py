# NEXUS AI - Logging System
"""
Comprehensive logging system using Loguru with structured logging,
activity tracking, and log rotation.
"""

import sys
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional, Dict
from loguru import logger


class NexusLogger:
    """
    Advanced logging system for NEXUS AI.
    Provides structured logging, activity tracking, and log management.
    """

    def __init__(self):
        self._configured = False
        self._activity_log_path: Optional[Path] = None
        self._agent_log_path: Optional[Path] = None
        self._security_log_path: Optional[Path] = None
        self._home_log_path: Optional[Path] = None

    def configure(self, log_dir: str = "./logs", level: str = "DEBUG",
                  rotation: str = "1 day", retention: str = "30 days"):
        """Configure the logging system with multiple log sinks."""
        if self._configured:
            return

        log_path = Path(log_dir)
        log_path.mkdir(parents=True, exist_ok=True)

        # Remove default handler
        logger.remove()

        # Console output with colors
        logger.add(
            sys.stderr,
            level=level,
            format="<green>{time:HH:mm:ss.SSS}</green> | "
                   "<level>{level:<8}</level> | "
                   "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
                   "<level>{message}</level>",
            colorize=True,
        )

        # Main application log
        logger.add(
            str(log_path / "nexus.log"),
            level=level,
            format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level:<8} | {name}:{function}:{line} | {message}",
            rotation=rotation,
            retention=retention,
            compression="zip",
            serialize=False,
        )

        # JSON structured log for analysis
        logger.add(
            str(log_path / "nexus_structured.json"),
            level=level,
            rotation=rotation,
            retention=retention,
            compression="zip",
            serialize=True,
        )

        # Activity log - tracks all user and system activities
        self._activity_log_path = log_path / "activities"
        self._activity_log_path.mkdir(exist_ok=True)
        logger.add(
            str(self._activity_log_path / "activity_{time:YYYY-MM-DD}.log"),
            level="INFO",
            format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level:<8} | ACTIVITY | {message}",
            filter=lambda record: record["extra"].get("log_type") == "activity",
            rotation="1 day",
            retention="90 days",
        )

        # Agent log - tracks all agent actions
        self._agent_log_path = log_path / "agents"
        self._agent_log_path.mkdir(exist_ok=True)
        logger.add(
            str(self._agent_log_path / "agents_{time:YYYY-MM-DD}.log"),
            level="DEBUG",
            format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level:<8} | AGENT | {message}",
            filter=lambda record: record["extra"].get("log_type") == "agent",
            rotation="1 day",
            retention="60 days",
        )

        # Security log
        self._security_log_path = log_path / "security"
        self._security_log_path.mkdir(exist_ok=True)
        logger.add(
            str(self._security_log_path / "security_{time:YYYY-MM-DD}.log"),
            level="WARNING",
            format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level:<8} | SECURITY | {message}",
            filter=lambda record: record["extra"].get("log_type") == "security",
            rotation="1 day",
            retention="365 days",
        )

        # Home automation log
        self._home_log_path = log_path / "home"
        self._home_log_path.mkdir(exist_ok=True)
        logger.add(
            str(self._home_log_path / "home_{time:YYYY-MM-DD}.log"),
            level="DEBUG",
            format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level:<8} | HOME | {message}",
            filter=lambda record: record["extra"].get("log_type") == "home",
            rotation="1 day",
            retention="90 days",
        )

        # Error log - consolidated errors
        logger.add(
            str(log_path / "errors.log"),
            level="ERROR",
            format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level:<8} | {name}:{function}:{line} | {message}\n{exception}",
            rotation="1 week",
            retention="90 days",
            compression="zip",
        )

        self._configured = True
        logger.info("NEXUS AI Logging System initialized")

    def log_activity(self, activity_type: str, description: str,
                     metadata: Optional[Dict[str, Any]] = None):
        """Log a user or system activity."""
        meta_str = json.dumps(metadata) if metadata else "{}"
        logger.bind(log_type="activity").info(
            f"[{activity_type}] {description} | metadata={meta_str}"
        )

    def log_agent_action(self, agent_name: str, action: str,
                         input_data: Optional[str] = None,
                         output_data: Optional[str] = None,
                         duration_ms: Optional[float] = None,
                         status: str = "success"):
        """Log an agent action with full context."""
        parts = [
            f"agent={agent_name}",
            f"action={action}",
            f"status={status}",
        ]
        if duration_ms is not None:
            parts.append(f"duration_ms={duration_ms:.2f}")
        if input_data:
            parts.append(f"input={input_data[:500]}")
        if output_data:
            parts.append(f"output={output_data[:500]}")

        log_msg = " | ".join(parts)
        if status == "success":
            logger.bind(log_type="agent").info(log_msg)
        elif status == "error":
            logger.bind(log_type="agent").error(log_msg)
        else:
            logger.bind(log_type="agent").warning(log_msg)

    def log_security_event(self, event_type: str, description: str,
                           severity: str = "warning",
                           metadata: Optional[Dict[str, Any]] = None):
        """Log a security event."""
        meta_str = json.dumps(metadata) if metadata else "{}"
        log_msg = f"[{event_type}] {description} | severity={severity} | metadata={meta_str}"

        if severity == "critical":
            logger.bind(log_type="security").critical(log_msg)
        elif severity == "high":
            logger.bind(log_type="security").error(log_msg)
        else:
            logger.bind(log_type="security").warning(log_msg)

    def log_home_event(self, device: str, event_type: str,
                       value: Any = None,
                       metadata: Optional[Dict[str, Any]] = None):
        """Log a home automation event."""
        meta_str = json.dumps(metadata) if metadata else "{}"
        logger.bind(log_type="home").info(
            f"device={device} | event={event_type} | value={value} | metadata={meta_str}"
        )

    def log_model_training(self, model_name: str, epoch: int,
                           loss: float, metrics: Optional[Dict[str, float]] = None):
        """Log model training progress."""
        metrics_str = json.dumps(metrics) if metrics else "{}"
        logger.bind(log_type="agent").info(
            f"TRAINING | model={model_name} | epoch={epoch} | loss={loss:.6f} | metrics={metrics_str}"
        )

    def log_voice_interaction(self, direction: str, text: str,
                              confidence: Optional[float] = None):
        """Log a voice interaction (input or output)."""
        conf_str = f" | confidence={confidence:.2f}" if confidence else ""
        logger.bind(log_type="activity").info(
            f"VOICE | direction={direction} | text={text[:200]}{conf_str}"
        )

    def log_email_event(self, event_type: str, subject: str,
                        sender: Optional[str] = None,
                        recipient: Optional[str] = None):
        """Log an email event."""
        parts = [f"event={event_type}", f"subject={subject[:100]}"]
        if sender:
            parts.append(f"from={sender}")
        if recipient:
            parts.append(f"to={recipient}")
        logger.bind(log_type="activity").info("EMAIL | " + " | ".join(parts))

    def log_financial_event(self, event_type: str, amount: Optional[float] = None,
                            category: Optional[str] = None,
                            description: Optional[str] = None):
        """Log a financial event."""
        parts = [f"event={event_type}"]
        if amount is not None:
            parts.append(f"amount={amount:.2f}")
        if category:
            parts.append(f"category={category}")
        if description:
            parts.append(f"description={description[:200]}")
        logger.bind(log_type="activity").info("FINANCIAL | " + " | ".join(parts))

    def log_health_event(self, event_type: str, metric: Optional[str] = None,
                         value: Optional[float] = None,
                         notes: Optional[str] = None):
        """Log a health-related event."""
        parts = [f"event={event_type}"]
        if metric:
            parts.append(f"metric={metric}")
        if value is not None:
            parts.append(f"value={value}")
        if notes:
            parts.append(f"notes={notes[:200]}")
        logger.bind(log_type="activity").info("HEALTH | " + " | ".join(parts))

    def log_system_event(self, event_type: str, description: str,
                         cpu: Optional[float] = None,
                         memory: Optional[float] = None,
                         disk: Optional[float] = None):
        """Log a system monitoring event."""
        parts = [f"event={event_type}", f"description={description}"]
        if cpu is not None:
            parts.append(f"cpu={cpu:.1f}%")
        if memory is not None:
            parts.append(f"memory={memory:.1f}%")
        if disk is not None:
            parts.append(f"disk={disk:.1f}%")
        logger.info("SYSTEM | " + " | ".join(parts))

    @property
    def raw(self):
        """Access the underlying loguru logger for direct use."""
        return logger


# Global logger instance
nexus_logger = NexusLogger()
