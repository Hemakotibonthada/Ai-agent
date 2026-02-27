# NEXUS AI - Database Repositories
"""
Repository pattern implementation for database operations.
Provides clean data access layer for all entities.
"""

import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import select, update, delete, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from .models import (
    UserProfile, PersonalityModel, Conversation, Message, Memory,
    Task, TaskStatus, TaskPriority,
    HomeDevice, SensorReading, HomeAutomation, PowerUsage,
    FinancialRecord, FinancialGoal, Budget,
    HealthMetric, MoodEntry,
    EmailRecord, ChatMessage,
    ActivityLog, TrainingLog, AgentState, Notification, Report,
)


class BaseRepository:
    """Base repository with common CRUD operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def _add(self, entity) -> Any:
        self.session.add(entity)
        await self.session.flush()
        return entity

    async def _get(self, model, entity_id: str) -> Optional[Any]:
        result = await self.session.execute(select(model).where(model.id == entity_id))
        return result.scalar_one_or_none()

    async def _delete(self, model, entity_id: str) -> bool:
        result = await self.session.execute(delete(model).where(model.id == entity_id))
        return result.rowcount > 0


class UserRepository(BaseRepository):
    """Repository for user profile operations."""

    async def create_user(self, name: str, **kwargs) -> UserProfile:
        user = UserProfile(id=str(uuid.uuid4()), name=name, **kwargs)
        return await self._add(user)

    async def get_user(self, user_id: str) -> Optional[UserProfile]:
        return await self._get(UserProfile, user_id)

    async def get_default_user(self) -> Optional[UserProfile]:
        result = await self.session.execute(
            select(UserProfile).order_by(UserProfile.created_at).limit(1)
        )
        return result.scalar_one_or_none()

    async def update_user(self, user_id: str, **kwargs) -> Optional[UserProfile]:
        user = await self.get_user(user_id)
        if user:
            for key, value in kwargs.items():
                if hasattr(user, key):
                    setattr(user, key, value)
            user.updated_at = datetime.utcnow()
            await self.session.flush()
        return user

    async def update_preferences(self, user_id: str, preferences: Dict) -> Optional[UserProfile]:
        user = await self.get_user(user_id)
        if user:
            current = user.preferences or {}
            current.update(preferences)
            user.preferences = current
            await self.session.flush()
        return user


class ConversationRepository(BaseRepository):
    """Repository for conversation and message operations."""

    async def create_conversation(self, user_id: str, title: str = None,
                                   agent_type: str = "personal") -> Conversation:
        conv = Conversation(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title=title or f"Conversation {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
            agent_type=agent_type,
        )
        return await self._add(conv)

    async def get_conversation(self, conv_id: str) -> Optional[Conversation]:
        return await self._get(Conversation, conv_id)

    async def get_user_conversations(self, user_id: str, limit: int = 50,
                                      agent_type: str = None) -> List[Conversation]:
        query = select(Conversation).where(
            Conversation.user_id == user_id
        ).order_by(desc(Conversation.updated_at)).limit(limit)

        if agent_type:
            query = query.where(Conversation.agent_type == agent_type)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def add_message(self, conversation_id: str, role: str, content: str,
                          agent_name: str = None, metadata: dict = None,
                          tokens_used: int = None,
                          processing_time_ms: float = None) -> Message:
        msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            role=role,
            content=content,
            agent_name=agent_name,
            metadata=metadata or {},
            tokens_used=tokens_used,
            processing_time_ms=processing_time_ms,
        )
        await self._add(msg)

        # Update conversation
        conv = await self.get_conversation(conversation_id)
        if conv:
            conv.message_count = (conv.message_count or 0) + 1
            conv.updated_at = datetime.utcnow()
            await self.session.flush()

        return msg

    async def get_messages(self, conversation_id: str, limit: int = 100,
                           before: datetime = None) -> List[Message]:
        query = select(Message).where(
            Message.conversation_id == conversation_id
        ).order_by(Message.created_at).limit(limit)

        if before:
            query = query.where(Message.created_at < before)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_recent_messages(self, conversation_id: str, limit: int = 20) -> List[Message]:
        query = select(Message).where(
            Message.conversation_id == conversation_id
        ).order_by(desc(Message.created_at)).limit(limit)
        result = await self.session.execute(query)
        messages = list(result.scalars().all())
        messages.reverse()
        return messages


class MemoryRepository(BaseRepository):
    """Repository for long-term memory operations."""

    async def store_memory(self, user_id: str, category: str, content: str,
                           importance: float = 0.5, source: str = None,
                           context: dict = None, embedding_id: str = None) -> Memory:
        memory = Memory(
            id=str(uuid.uuid4()),
            user_id=user_id,
            category=category,
            content=content,
            importance=importance,
            source=source,
            context=context or {},
            embedding_id=embedding_id,
        )
        return await self._add(memory)

    async def get_memories(self, user_id: str, category: str = None,
                           min_importance: float = 0.0,
                           limit: int = 50) -> List[Memory]:
        query = select(Memory).where(
            and_(
                Memory.user_id == user_id,
                Memory.importance >= min_importance,
            )
        ).order_by(desc(Memory.importance)).limit(limit)

        if category:
            query = query.where(Memory.category == category)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def search_memories(self, user_id: str, search_term: str,
                              limit: int = 20) -> List[Memory]:
        query = select(Memory).where(
            and_(
                Memory.user_id == user_id,
                Memory.content.ilike(f"%{search_term}%"),
            )
        ).order_by(desc(Memory.importance)).limit(limit)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def update_access(self, memory_id: str):
        memory = await self._get(Memory, memory_id)
        if memory:
            memory.access_count += 1
            memory.last_accessed = datetime.utcnow()
            await self.session.flush()


class TaskRepository(BaseRepository):
    """Repository for task management operations."""

    async def create_task(self, user_id: str, title: str, **kwargs) -> Task:
        task = Task(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title=title,
            **kwargs,
        )
        return await self._add(task)

    async def get_task(self, task_id: str) -> Optional[Task]:
        return await self._get(Task, task_id)

    async def get_user_tasks(self, user_id: str, status: str = None,
                              priority: str = None, limit: int = 100) -> List[Task]:
        query = select(Task).where(Task.user_id == user_id)

        if status:
            query = query.where(Task.status == status)
        if priority:
            query = query.where(Task.priority == priority)

        query = query.order_by(Task.created_at.desc()).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def update_task_status(self, task_id: str, status: str,
                                  result: dict = None) -> Optional[Task]:
        task = await self.get_task(task_id)
        if task:
            task.status = status
            if status == TaskStatus.COMPLETED.value:
                task.completed_at = datetime.utcnow()
            if result:
                task.result = result
            task.updated_at = datetime.utcnow()
            await self.session.flush()
        return task

    async def get_pending_tasks(self, limit: int = 50) -> List[Task]:
        query = select(Task).where(
            Task.status == TaskStatus.PENDING.value
        ).order_by(Task.created_at).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_overdue_tasks(self, user_id: str) -> List[Task]:
        now = datetime.utcnow()
        query = select(Task).where(
            and_(
                Task.user_id == user_id,
                Task.status.in_([TaskStatus.PENDING.value, TaskStatus.IN_PROGRESS.value]),
                Task.due_date < now,
            )
        ).order_by(Task.due_date)
        result = await self.session.execute(query)
        return list(result.scalars().all())


class HomeRepository(BaseRepository):
    """Repository for home automation operations."""

    async def add_device(self, name: str, device_type: str,
                         room: str = None, **kwargs) -> HomeDevice:
        device = HomeDevice(
            id=str(uuid.uuid4()),
            name=name,
            device_type=device_type,
            room=room,
            **kwargs,
        )
        return await self._add(device)

    async def get_device(self, device_id: str) -> Optional[HomeDevice]:
        return await self._get(HomeDevice, device_id)

    async def get_all_devices(self, room: str = None,
                               device_type: str = None) -> List[HomeDevice]:
        query = select(HomeDevice)
        if room:
            query = query.where(HomeDevice.room == room)
        if device_type:
            query = query.where(HomeDevice.device_type == device_type)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def update_device_state(self, device_id: str, state: dict) -> Optional[HomeDevice]:
        device = await self.get_device(device_id)
        if device:
            current_state = device.state or {}
            current_state.update(state)
            device.state = current_state
            device.last_seen = datetime.utcnow()
            device.is_online = True
            await self.session.flush()
        return device

    async def add_sensor_reading(self, device_id: str, sensor_type: str,
                                  value: float, unit: str,
                                  metadata: dict = None) -> SensorReading:
        reading = SensorReading(
            id=str(uuid.uuid4()),
            device_id=device_id,
            sensor_type=sensor_type,
            value=value,
            unit=unit,
            metadata=metadata or {},
        )
        return await self._add(reading)

    async def get_sensor_readings(self, device_id: str, sensor_type: str = None,
                                   hours: int = 24, limit: int = 1000) -> List[SensorReading]:
        since = datetime.utcnow() - timedelta(hours=hours)
        query = select(SensorReading).where(
            and_(
                SensorReading.device_id == device_id,
                SensorReading.timestamp >= since,
            )
        ).order_by(SensorReading.timestamp.desc()).limit(limit)

        if sensor_type:
            query = query.where(SensorReading.sensor_type == sensor_type)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def add_power_usage(self, watts: float, device_id: str = None,
                               kwh: float = None, cost: float = None) -> PowerUsage:
        usage = PowerUsage(
            id=str(uuid.uuid4()),
            device_id=device_id,
            watts=watts,
            kilowatt_hours=kwh,
            cost_estimate=cost,
        )
        return await self._add(usage)

    async def get_power_usage(self, hours: int = 24) -> List[PowerUsage]:
        since = datetime.utcnow() - timedelta(hours=hours)
        query = select(PowerUsage).where(
            PowerUsage.timestamp >= since
        ).order_by(PowerUsage.timestamp.desc())
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_rooms(self) -> List[str]:
        query = select(HomeDevice.room).distinct().where(HomeDevice.room.isnot(None))
        result = await self.session.execute(query)
        return [row[0] for row in result.all()]


class FinancialRepository(BaseRepository):
    """Repository for financial data operations."""

    async def add_record(self, user_id: str, transaction_type: str,
                          amount: float, category: str,
                          date: datetime = None, **kwargs) -> FinancialRecord:
        record = FinancialRecord(
            id=str(uuid.uuid4()),
            user_id=user_id,
            transaction_type=transaction_type,
            amount=amount,
            category=category,
            date=date or datetime.utcnow(),
            **kwargs,
        )
        return await self._add(record)

    async def get_records(self, user_id: str, start_date: datetime = None,
                           end_date: datetime = None, category: str = None,
                           transaction_type: str = None,
                           limit: int = 100) -> List[FinancialRecord]:
        query = select(FinancialRecord).where(
            FinancialRecord.user_id == user_id
        ).order_by(desc(FinancialRecord.date)).limit(limit)

        if start_date:
            query = query.where(FinancialRecord.date >= start_date)
        if end_date:
            query = query.where(FinancialRecord.date <= end_date)
        if category:
            query = query.where(FinancialRecord.category == category)
        if transaction_type:
            query = query.where(FinancialRecord.transaction_type == transaction_type)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_spending_summary(self, user_id: str,
                                    start_date: datetime,
                                    end_date: datetime) -> Dict[str, float]:
        query = select(
            FinancialRecord.category,
            func.sum(FinancialRecord.amount)
        ).where(
            and_(
                FinancialRecord.user_id == user_id,
                FinancialRecord.transaction_type == "expense",
                FinancialRecord.date >= start_date,
                FinancialRecord.date <= end_date,
            )
        ).group_by(FinancialRecord.category)

        result = await self.session.execute(query)
        return dict(result.all())

    async def get_income_summary(self, user_id: str,
                                  start_date: datetime,
                                  end_date: datetime) -> float:
        query = select(func.sum(FinancialRecord.amount)).where(
            and_(
                FinancialRecord.user_id == user_id,
                FinancialRecord.transaction_type == "income",
                FinancialRecord.date >= start_date,
                FinancialRecord.date <= end_date,
            )
        )
        result = await self.session.execute(query)
        return result.scalar() or 0.0

    async def create_goal(self, user_id: str, name: str,
                           target_amount: float, **kwargs) -> FinancialGoal:
        goal = FinancialGoal(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name=name,
            target_amount=target_amount,
            **kwargs,
        )
        return await self._add(goal)

    async def get_goals(self, user_id: str, status: str = "active") -> List[FinancialGoal]:
        query = select(FinancialGoal).where(
            and_(FinancialGoal.user_id == user_id, FinancialGoal.status == status)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_budget(self, user_id: str, month: int, year: int) -> List[Budget]:
        query = select(Budget).where(
            and_(Budget.user_id == user_id, Budget.month == month, Budget.year == year)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())


class HealthRepository(BaseRepository):
    """Repository for health metrics operations."""

    async def add_metric(self, user_id: str, metric_type: str,
                          value: float, unit: str, **kwargs) -> HealthMetric:
        metric = HealthMetric(
            id=str(uuid.uuid4()),
            user_id=user_id,
            metric_type=metric_type,
            value=value,
            unit=unit,
            **kwargs,
        )
        return await self._add(metric)

    async def get_metrics(self, user_id: str, metric_type: str = None,
                           days: int = 30, limit: int = 500) -> List[HealthMetric]:
        since = datetime.utcnow() - timedelta(days=days)
        query = select(HealthMetric).where(
            and_(
                HealthMetric.user_id == user_id,
                HealthMetric.recorded_at >= since,
            )
        ).order_by(desc(HealthMetric.recorded_at)).limit(limit)

        if metric_type:
            query = query.where(HealthMetric.metric_type == metric_type)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def add_mood_entry(self, user_id: str, mood_score: int,
                              **kwargs) -> MoodEntry:
        entry = MoodEntry(
            id=str(uuid.uuid4()),
            user_id=user_id,
            mood_score=mood_score,
            **kwargs,
        )
        return await self._add(entry)

    async def get_mood_history(self, user_id: str, days: int = 30) -> List[MoodEntry]:
        since = datetime.utcnow() - timedelta(days=days)
        query = select(MoodEntry).where(
            and_(MoodEntry.user_id == user_id, MoodEntry.recorded_at >= since)
        ).order_by(desc(MoodEntry.recorded_at))
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_average_mood(self, user_id: str, days: int = 7) -> Optional[float]:
        since = datetime.utcnow() - timedelta(days=days)
        query = select(func.avg(MoodEntry.mood_score)).where(
            and_(MoodEntry.user_id == user_id, MoodEntry.recorded_at >= since)
        )
        result = await self.session.execute(query)
        return result.scalar()


class ActivityLogRepository(BaseRepository):
    """Repository for activity log operations."""

    async def log_activity(self, activity_type: str, description: str,
                            agent_name: str = None, metadata: dict = None,
                            duration_ms: float = None,
                            status: str = "success") -> ActivityLog:
        log = ActivityLog(
            id=str(uuid.uuid4()),
            activity_type=activity_type,
            agent_name=agent_name,
            description=description,
            metadata=metadata or {},
            duration_ms=duration_ms,
            status=status,
        )
        return await self._add(log)

    async def get_logs(self, activity_type: str = None,
                       agent_name: str = None,
                       hours: int = 24,
                       limit: int = 200) -> List[ActivityLog]:
        since = datetime.utcnow() - timedelta(hours=hours)
        query = select(ActivityLog).where(
            ActivityLog.created_at >= since
        ).order_by(desc(ActivityLog.created_at)).limit(limit)

        if activity_type:
            query = query.where(ActivityLog.activity_type == activity_type)
        if agent_name:
            query = query.where(ActivityLog.agent_name == agent_name)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_stats(self, hours: int = 24) -> Dict[str, Any]:
        since = datetime.utcnow() - timedelta(hours=hours)

        total = await self.session.execute(
            select(func.count(ActivityLog.id)).where(ActivityLog.created_at >= since)
        )
        by_type = await self.session.execute(
            select(ActivityLog.activity_type, func.count(ActivityLog.id)).where(
                ActivityLog.created_at >= since
            ).group_by(ActivityLog.activity_type)
        )
        by_agent = await self.session.execute(
            select(ActivityLog.agent_name, func.count(ActivityLog.id)).where(
                and_(ActivityLog.created_at >= since, ActivityLog.agent_name.isnot(None))
            ).group_by(ActivityLog.agent_name)
        )

        return {
            "total": total.scalar() or 0,
            "by_type": dict(by_type.all()),
            "by_agent": dict(by_agent.all()),
        }


class NotificationRepository(BaseRepository):
    """Repository for notification operations."""

    async def create_notification(self, user_id: str, title: str, message: str,
                                   notification_type: str = "info",
                                   source_agent: str = None,
                                   **kwargs) -> Notification:
        notif = Notification(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
            source_agent=source_agent,
            **kwargs,
        )
        return await self._add(notif)

    async def get_unread(self, user_id: str, limit: int = 50) -> List[Notification]:
        query = select(Notification).where(
            and_(Notification.user_id == user_id, Notification.is_read == False)
        ).order_by(desc(Notification.created_at)).limit(limit)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def mark_read(self, notification_id: str) -> bool:
        notif = await self._get(Notification, notification_id)
        if notif:
            notif.is_read = True
            await self.session.flush()
            return True
        return False

    async def mark_all_read(self, user_id: str) -> int:
        result = await self.session.execute(
            update(Notification).where(
                and_(Notification.user_id == user_id, Notification.is_read == False)
            ).values(is_read=True)
        )
        return result.rowcount


class ReportRepository(BaseRepository):
    """Repository for report operations."""

    async def create_report(self, user_id: str, title: str, report_type: str,
                             format: str, file_path: str, **kwargs) -> Report:
        report = Report(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title=title,
            report_type=report_type,
            format=format,
            file_path=file_path,
            **kwargs,
        )
        return await self._add(report)

    async def get_reports(self, user_id: str, report_type: str = None,
                           limit: int = 50) -> List[Report]:
        query = select(Report).where(
            Report.user_id == user_id
        ).order_by(desc(Report.created_at)).limit(limit)

        if report_type:
            query = query.where(Report.report_type == report_type)

        result = await self.session.execute(query)
        return list(result.scalars().all())
