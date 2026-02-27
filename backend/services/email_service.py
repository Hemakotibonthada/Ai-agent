# NEXUS AI - Email Service
"""
Full email management service with IMAP/SMTP support, auto-reply,
email summarization, inbox monitoring, draft composition, and
AI-powered email categorization for the NEXUS AI OS.
"""

import asyncio
import email
import email.mime.multipart
import email.mime.text
import email.utils
import imaplib
import json
import time
import uuid
from datetime import datetime, timedelta
from email.header import decode_header
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import aiosmtplib
from loguru import logger

from core.config import NexusSettings, settings
from core.events import Event, EventBus, EventCategory, EventPriority, event_bus
from core.logger import nexus_logger


class EmailMessage:
    """Structured representation of an email message."""

    def __init__(
        self,
        message_id: str = "",
        sender: str = "",
        recipients: Optional[List[str]] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        subject: str = "",
        body_text: str = "",
        body_html: str = "",
        date: Optional[datetime] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        is_read: bool = False,
        folder: str = "INBOX",
        uid: Optional[str] = None,
    ):
        self.message_id: str = message_id or str(uuid.uuid4())
        self.sender: str = sender
        self.recipients: List[str] = recipients or []
        self.cc: List[str] = cc or []
        self.bcc: List[str] = bcc or []
        self.subject: str = subject
        self.body_text: str = body_text
        self.body_html: str = body_html
        self.date: datetime = date or datetime.utcnow()
        self.attachments: List[Dict[str, Any]] = attachments or []
        self.is_read: bool = is_read
        self.folder: str = folder
        self.uid: Optional[str] = uid

    def to_dict(self) -> Dict[str, Any]:
        """Serialize email message to dictionary."""
        return {
            "message_id": self.message_id,
            "sender": self.sender,
            "recipients": self.recipients,
            "cc": self.cc,
            "subject": self.subject,
            "body_text": self.body_text[:500] if self.body_text else "",
            "date": self.date.isoformat() if self.date else "",
            "is_read": self.is_read,
            "folder": self.folder,
            "has_attachments": len(self.attachments) > 0,
            "attachment_count": len(self.attachments),
        }

    @property
    def preview(self) -> str:
        """Short preview of the email body."""
        text = self.body_text or self.body_html or ""
        return text[:200].strip()


class EmailDraft:
    """Draft email ready for sending."""

    def __init__(
        self,
        to: Optional[List[str]] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        subject: str = "",
        body: str = "",
        html_body: str = "",
        reply_to: Optional[str] = None,
        attachments: Optional[List[str]] = None,
    ):
        self.to: List[str] = to or []
        self.cc: List[str] = cc or []
        self.bcc: List[str] = bcc or []
        self.subject: str = subject
        self.body: str = body
        self.html_body: str = html_body
        self.reply_to: Optional[str] = reply_to
        self.attachments: List[str] = attachments or []
        self.draft_id: str = str(uuid.uuid4())
        self.created_at: datetime = datetime.utcnow()


class EmailService:
    """
    Comprehensive email management service for NEXUS AI.

    Provides:
    - IMAP inbox polling and message retrieval
    - SMTP email sending
    - Auto-reply generation using AI
    - Email summarization
    - Draft composition and management
    - Email categorization and priority detection
    - Inbox monitoring with event-driven notifications
    """

    def __init__(self, config: Optional[NexusSettings] = None,
                 event_bus_instance: Optional[EventBus] = None,
                 ai_service: Optional[Any] = None):
        self._config: NexusSettings = config or settings
        self._event_bus: EventBus = event_bus_instance or event_bus
        self._ai_service: Optional[Any] = ai_service
        self._smtp_host: str = self._config.email.smtp_host
        self._smtp_port: int = self._config.email.smtp_port
        self._imap_host: str = self._config.email.imap_host
        self._imap_port: int = self._config.email.imap_port
        self._username: str = self._config.email.username
        self._password: str = self._config.email.password
        self._check_interval: int = self._config.email.check_interval
        self._initialized: bool = False
        self._monitoring: bool = False
        self._monitor_task: Optional[asyncio.Task] = None
        self._known_uids: set = set()
        self._drafts: Dict[str, EmailDraft] = {}
        self._sent_count: int = 0
        self._received_count: int = 0
        self._error_count: int = 0
        self._auto_reply_rules: List[Dict[str, Any]] = []
        self._auto_reply_enabled: bool = False
        self._callbacks: List[Callable] = []

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def initialize(self) -> None:
        """Initialize the email service and verify credentials."""
        try:
            logger.info("Initializing EmailService...")
            if self._username and self._password:
                connected = await self._test_imap_connection()
                if connected:
                    logger.info("IMAP connection verified")
                else:
                    logger.warning("IMAP connection could not be verified")
            else:
                logger.warning("Email credentials not configured — service in limited mode")
            self._initialized = True
            await self._event_bus.emit(
                "email.initialized",
                {"smtp_host": self._smtp_host, "imap_host": self._imap_host},
                source="email_service",
                category=EventCategory.COMMUNICATION,
            )
            logger.info("EmailService initialized")
        except Exception as exc:
            logger.error(f"EmailService initialization failed: {exc}")
            self._initialized = True

    async def shutdown(self) -> None:
        """Stop monitoring and release resources."""
        try:
            logger.info("Shutting down EmailService...")
            await self.stop_monitoring()
            self._drafts.clear()
            self._initialized = False
            logger.info("EmailService shut down complete")
        except Exception as exc:
            logger.error(f"Error during EmailService shutdown: {exc}")

    # ------------------------------------------------------------------
    # IMAP Operations
    # ------------------------------------------------------------------

    async def _test_imap_connection(self) -> bool:
        """Test IMAP connectivity with current credentials."""
        def _connect() -> bool:
            try:
                conn = imaplib.IMAP4_SSL(self._imap_host, self._imap_port)
                conn.login(self._username, self._password)
                conn.logout()
                return True
            except Exception as exc:
                logger.error(f"IMAP connection test failed: {exc}")
                return False

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _connect)

    async def fetch_emails(
        self, folder: str = "INBOX", limit: int = 20,
        since: Optional[datetime] = None, unseen_only: bool = False,
    ) -> List[EmailMessage]:
        """
        Fetch emails from the specified folder.

        Args:
            folder: IMAP folder name.
            limit: Maximum number of emails to retrieve.
            since: Only fetch emails after this date.
            unseen_only: Only fetch unread emails.

        Returns:
            List of EmailMessage objects, newest first.
        """
        def _fetch() -> List[EmailMessage]:
            messages: List[EmailMessage] = []
            try:
                conn = imaplib.IMAP4_SSL(self._imap_host, self._imap_port)
                conn.login(self._username, self._password)
                conn.select(folder, readonly=True)

                search_criteria: List[str] = []
                if unseen_only:
                    search_criteria.append("UNSEEN")
                if since:
                    date_str = since.strftime("%d-%b-%Y")
                    search_criteria.append(f'SINCE {date_str}')
                if not search_criteria:
                    search_criteria.append("ALL")

                criteria_str = " ".join(search_criteria)
                status, data = conn.search(None, f"({criteria_str})")
                if status != "OK" or not data or not data[0]:
                    conn.logout()
                    return messages

                msg_ids = data[0].split()
                msg_ids = msg_ids[-limit:]
                msg_ids.reverse()

                for mid in msg_ids:
                    try:
                        status, msg_data = conn.fetch(mid, "(RFC822 UID FLAGS)")
                        if status != "OK" or not msg_data or not msg_data[0]:
                            continue

                        raw_email = msg_data[0][1] if isinstance(msg_data[0], tuple) else msg_data[0]
                        if isinstance(raw_email, bytes):
                            parsed = email.message_from_bytes(raw_email)
                        else:
                            continue

                        msg = self._parse_email_message(parsed, folder)
                        messages.append(msg)
                    except Exception as exc:
                        logger.error(f"Error parsing email {mid}: {exc}")
                        continue

                conn.logout()
            except Exception as exc:
                logger.error(f"IMAP fetch error: {exc}")
            return messages

        loop = asyncio.get_running_loop()
        emails = await loop.run_in_executor(None, _fetch)
        self._received_count += len(emails)
        return emails

    def _parse_email_message(self, msg: email.message.Message,
                             folder: str) -> EmailMessage:
        """Parse a raw email.message.Message into an EmailMessage."""
        subject = ""
        raw_subject = msg.get("Subject", "")
        if raw_subject:
            decoded_parts = decode_header(raw_subject)
            subject_parts = []
            for part, charset in decoded_parts:
                if isinstance(part, bytes):
                    subject_parts.append(part.decode(charset or "utf-8", errors="replace"))
                else:
                    subject_parts.append(str(part))
            subject = " ".join(subject_parts)

        sender = msg.get("From", "")
        to_raw = msg.get("To", "")
        cc_raw = msg.get("Cc", "")
        recipients = [addr.strip() for addr in to_raw.split(",") if addr.strip()]
        cc = [addr.strip() for addr in cc_raw.split(",") if addr.strip()]

        date = None
        date_str = msg.get("Date", "")
        if date_str:
            try:
                parsed_date = email.utils.parsedate_to_datetime(date_str)
                date = parsed_date
            except Exception:
                date = datetime.utcnow()

        body_text = ""
        body_html = ""
        attachments: List[Dict[str, Any]] = []

        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                disposition = str(part.get("Content-Disposition", ""))
                if "attachment" in disposition:
                    attachments.append({
                        "filename": part.get_filename() or "unnamed",
                        "content_type": content_type,
                        "size": len(part.get_payload(decode=True) or b""),
                    })
                elif content_type == "text/plain":
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or "utf-8"
                        body_text += payload.decode(charset, errors="replace")
                elif content_type == "text/html":
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or "utf-8"
                        body_html += payload.decode(charset, errors="replace")
        else:
            content_type = msg.get_content_type()
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or "utf-8"
                decoded = payload.decode(charset, errors="replace")
                if content_type == "text/html":
                    body_html = decoded
                else:
                    body_text = decoded

        message_id = msg.get("Message-ID", str(uuid.uuid4()))

        return EmailMessage(
            message_id=message_id,
            sender=sender,
            recipients=recipients,
            cc=cc,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            date=date,
            attachments=attachments,
            folder=folder,
        )

    async def get_folder_list(self) -> List[str]:
        """
        List all IMAP folders/mailboxes.

        Returns:
            List of folder names.
        """
        def _list() -> List[str]:
            folders: List[str] = []
            try:
                conn = imaplib.IMAP4_SSL(self._imap_host, self._imap_port)
                conn.login(self._username, self._password)
                status, data = conn.list()
                if status == "OK" and data:
                    for item in data:
                        if isinstance(item, bytes):
                            parts = item.decode("utf-8", errors="replace").split(' "/" ')
                            if len(parts) >= 2:
                                folders.append(parts[-1].strip('"'))
                conn.logout()
            except Exception as exc:
                logger.error(f"IMAP list folders error: {exc}")
            return folders

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _list)

    async def mark_as_read(self, folder: str, uid: str) -> bool:
        """
        Mark an email as read.

        Args:
            folder: IMAP folder.
            uid: Email UID.

        Returns:
            True if successful.
        """
        def _mark() -> bool:
            try:
                conn = imaplib.IMAP4_SSL(self._imap_host, self._imap_port)
                conn.login(self._username, self._password)
                conn.select(folder)
                conn.uid("STORE", uid, "+FLAGS", "(\\Seen)")
                conn.logout()
                return True
            except Exception as exc:
                logger.error(f"Mark as read error: {exc}")
                return False

        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _mark)

    # ------------------------------------------------------------------
    # SMTP Operations
    # ------------------------------------------------------------------

    async def send_email(self, draft: EmailDraft) -> bool:
        """
        Send an email using SMTP.

        Args:
            draft: EmailDraft object containing the email to send.

        Returns:
            True if sent successfully.
        """
        try:
            msg = email.mime.multipart.MIMEMultipart("alternative")
            msg["From"] = self._username
            msg["To"] = ", ".join(draft.to)
            if draft.cc:
                msg["Cc"] = ", ".join(draft.cc)
            msg["Subject"] = draft.subject
            msg["Date"] = email.utils.formatdate(localtime=True)
            msg["Message-ID"] = email.utils.make_msgid()

            if draft.reply_to:
                msg["In-Reply-To"] = draft.reply_to
                msg["References"] = draft.reply_to

            if draft.body:
                msg.attach(email.mime.text.MIMEText(draft.body, "plain", "utf-8"))
            if draft.html_body:
                msg.attach(email.mime.text.MIMEText(draft.html_body, "html", "utf-8"))

            all_recipients = draft.to + draft.cc + draft.bcc

            await aiosmtplib.send(
                msg,
                hostname=self._smtp_host,
                port=self._smtp_port,
                username=self._username,
                password=self._password,
                start_tls=True,
                recipients=all_recipients,
            )

            self._sent_count += 1
            nexus_logger.log_email_event(
                "sent", draft.subject,
                sender=self._username,
                recipient=", ".join(draft.to),
            )
            await self._event_bus.emit(
                "email.sent",
                {"subject": draft.subject, "to": draft.to},
                source="email_service",
                category=EventCategory.COMMUNICATION,
            )
            logger.info(f"Email sent: '{draft.subject}' to {draft.to}")
            return True
        except Exception as exc:
            self._error_count += 1
            logger.error(f"Failed to send email: {exc}")
            return False

    async def send_quick_email(
        self, to: str, subject: str, body: str, html: bool = False
    ) -> bool:
        """
        Convenience method to send a simple email.

        Args:
            to: Recipient email address.
            subject: Email subject.
            body: Email body.
            html: Whether body is HTML.

        Returns:
            True if sent.
        """
        draft = EmailDraft(to=[to], subject=subject)
        if html:
            draft.html_body = body
        else:
            draft.body = body
        return await self.send_email(draft)

    # ------------------------------------------------------------------
    # Draft Management
    # ------------------------------------------------------------------

    def create_draft(
        self, to: List[str], subject: str, body: str,
        cc: Optional[List[str]] = None,
    ) -> EmailDraft:
        """
        Create and store an email draft.

        Args:
            to: List of recipient addresses.
            subject: Email subject.
            body: Email body.
            cc: Optional CC recipients.

        Returns:
            The created EmailDraft.
        """
        draft = EmailDraft(to=to, cc=cc or [], subject=subject, body=body)
        self._drafts[draft.draft_id] = draft
        logger.debug(f"Draft created: {draft.draft_id} — '{subject}'")
        return draft

    def get_draft(self, draft_id: str) -> Optional[EmailDraft]:
        """Retrieve a draft by ID."""
        return self._drafts.get(draft_id)

    def update_draft(self, draft_id: str, **kwargs: Any) -> Optional[EmailDraft]:
        """
        Update fields of an existing draft.

        Args:
            draft_id: ID of the draft to update.
            **kwargs: Fields to update (to, cc, subject, body, etc.).

        Returns:
            Updated draft or None if not found.
        """
        draft = self._drafts.get(draft_id)
        if not draft:
            return None
        for key, value in kwargs.items():
            if hasattr(draft, key):
                setattr(draft, key, value)
        return draft

    def delete_draft(self, draft_id: str) -> bool:
        """Delete a draft by ID."""
        return self._drafts.pop(draft_id, None) is not None

    def list_drafts(self) -> List[Dict[str, Any]]:
        """List all current drafts."""
        return [
            {
                "draft_id": d.draft_id,
                "to": d.to,
                "subject": d.subject,
                "body_preview": d.body[:100] if d.body else "",
                "created_at": d.created_at.isoformat(),
            }
            for d in self._drafts.values()
        ]

    # ------------------------------------------------------------------
    # AI-Powered Features
    # ------------------------------------------------------------------

    async def summarize_email(self, email_msg: EmailMessage) -> str:
        """
        Generate an AI summary of an email.

        Args:
            email_msg: The email to summarize.

        Returns:
            Summary text string.
        """
        if not self._ai_service:
            return email_msg.preview

        text = email_msg.body_text or email_msg.body_html
        if not text:
            return "Empty email"

        try:
            summary = await self._ai_service.summarize(
                f"From: {email_msg.sender}\n"
                f"Subject: {email_msg.subject}\n\n{text}",
                max_length=100,
            )
            return summary
        except Exception as exc:
            logger.error(f"Email summarization error: {exc}")
            return email_msg.preview

    async def categorize_email(self, email_msg: EmailMessage) -> Dict[str, Any]:
        """
        Categorize an email using AI.

        Args:
            email_msg: The email to categorize.

        Returns:
            Dict with 'category', 'priority', 'sentiment'.
        """
        if not self._ai_service:
            return {"category": "general", "priority": "normal", "sentiment": "neutral"}

        text = f"From: {email_msg.sender}\nSubject: {email_msg.subject}\n\n{email_msg.preview}"
        try:
            result = await self._ai_service.classify_text(
                text,
                ["work", "personal", "finance", "marketing", "social", "urgent", "spam"],
            )
            return {
                "category": result.get("category", "general"),
                "priority": "high" if result.get("category") == "urgent" else "normal",
                "sentiment": result.get("reasoning", "neutral")[:50],
            }
        except Exception as exc:
            logger.error(f"Email categorization error: {exc}")
            return {"category": "general", "priority": "normal", "sentiment": "neutral"}

    async def generate_reply(
        self, email_msg: EmailMessage, tone: str = "professional",
        instructions: Optional[str] = None,
    ) -> str:
        """
        Generate an AI-powered reply to an email.

        Args:
            email_msg: The email to reply to.
            tone: Desired tone (professional, friendly, brief, formal).
            instructions: Additional instructions for the AI.

        Returns:
            Generated reply text.
        """
        if not self._ai_service:
            return ""

        prompt = (
            f"Generate a {tone} reply to the following email.\n\n"
            f"From: {email_msg.sender}\n"
            f"Subject: {email_msg.subject}\n"
            f"Body:\n{email_msg.body_text or email_msg.body_html}\n\n"
        )
        if instructions:
            prompt += f"Additional instructions: {instructions}\n\n"
        prompt += "Reply:"

        try:
            result = await self._ai_service.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=1024,
            )
            return result.get("content", "").strip()
        except Exception as exc:
            logger.error(f"Reply generation error: {exc}")
            return ""

    # ------------------------------------------------------------------
    # Auto-Reply
    # ------------------------------------------------------------------

    def add_auto_reply_rule(
        self, conditions: Dict[str, str], reply_template: str,
        enabled: bool = True,
    ) -> str:
        """
        Add an auto-reply rule.

        Args:
            conditions: Dict of conditions (e.g., {'sender_contains': '@example.com'}).
            reply_template: Template for the auto-reply body.
            enabled: Whether the rule is active.

        Returns:
            Rule ID.
        """
        rule_id = str(uuid.uuid4())
        self._auto_reply_rules.append({
            "rule_id": rule_id,
            "conditions": conditions,
            "reply_template": reply_template,
            "enabled": enabled,
            "created_at": datetime.utcnow().isoformat(),
        })
        logger.info(f"Auto-reply rule added: {rule_id}")
        return rule_id

    def remove_auto_reply_rule(self, rule_id: str) -> bool:
        """Remove an auto-reply rule by ID."""
        for i, rule in enumerate(self._auto_reply_rules):
            if rule["rule_id"] == rule_id:
                self._auto_reply_rules.pop(i)
                return True
        return False

    def set_auto_reply_enabled(self, enabled: bool) -> None:
        """Enable or disable the auto-reply system."""
        self._auto_reply_enabled = enabled
        logger.info(f"Auto-reply {'enabled' if enabled else 'disabled'}")

    async def _check_auto_reply(self, email_msg: EmailMessage) -> None:
        """Check if any auto-reply rules match and send reply if so."""
        if not self._auto_reply_enabled:
            return

        for rule in self._auto_reply_rules:
            if not rule["enabled"]:
                continue
            conditions = rule["conditions"]
            match = True

            if "sender_contains" in conditions:
                if conditions["sender_contains"].lower() not in email_msg.sender.lower():
                    match = False
            if "subject_contains" in conditions:
                if conditions["subject_contains"].lower() not in email_msg.subject.lower():
                    match = False

            if match:
                reply_body = rule["reply_template"]
                reply_body = reply_body.replace("{sender}", email_msg.sender)
                reply_body = reply_body.replace("{subject}", email_msg.subject)

                success = await self.send_quick_email(
                    to=email_msg.sender,
                    subject=f"Re: {email_msg.subject}",
                    body=reply_body,
                )
                if success:
                    logger.info(f"Auto-reply sent to {email_msg.sender}: rule {rule['rule_id']}")
                    await self._event_bus.emit(
                        "email.auto_reply_sent",
                        {"to": email_msg.sender, "subject": email_msg.subject, "rule_id": rule["rule_id"]},
                        source="email_service",
                        category=EventCategory.COMMUNICATION,
                    )
                break

    # ------------------------------------------------------------------
    # Inbox Monitoring
    # ------------------------------------------------------------------

    async def start_monitoring(self) -> None:
        """Start background inbox monitoring."""
        if self._monitoring:
            logger.warning("Email monitoring already active")
            return
        self._monitoring = True
        self._monitor_task = asyncio.create_task(self._monitoring_loop())
        logger.info(f"Email monitoring started (interval: {self._check_interval}s)")

    async def stop_monitoring(self) -> None:
        """Stop background inbox monitoring."""
        self._monitoring = False
        if self._monitor_task and not self._monitor_task.done():
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
        self._monitor_task = None
        logger.info("Email monitoring stopped")

    async def _monitoring_loop(self) -> None:
        """Main monitoring loop — polls for new emails periodically."""
        while self._monitoring:
            try:
                new_emails = await self.fetch_emails(unseen_only=True, limit=50)
                for em in new_emails:
                    if em.message_id not in self._known_uids:
                        self._known_uids.add(em.message_id)
                        logger.info(f"New email: '{em.subject}' from {em.sender}")
                        nexus_logger.log_email_event(
                            "received", em.subject, sender=em.sender,
                        )
                        await self._event_bus.emit(
                            "email.received",
                            em.to_dict(),
                            source="email_service",
                            category=EventCategory.COMMUNICATION,
                            priority=EventPriority.NORMAL,
                        )
                        await self._check_auto_reply(em)
                        for cb in self._callbacks:
                            try:
                                if asyncio.iscoroutinefunction(cb):
                                    await cb(em)
                                else:
                                    cb(em)
                            except Exception as exc:
                                logger.error(f"Email callback error: {exc}")
            except Exception as exc:
                self._error_count += 1
                logger.error(f"Email monitoring error: {exc}")

            await asyncio.sleep(self._check_interval)

    def register_callback(self, callback: Callable) -> None:
        """Register a callback for new email events."""
        self._callbacks.append(callback)

    # ------------------------------------------------------------------
    # Health & Stats
    # ------------------------------------------------------------------

    async def health_check(self) -> Dict[str, Any]:
        """Return email service health status."""
        imap_ok = await self._test_imap_connection() if self._username else False
        return {
            "service": "email_service",
            "initialized": self._initialized,
            "imap_connected": imap_ok,
            "monitoring": self._monitoring,
            "smtp_host": self._smtp_host,
            "imap_host": self._imap_host,
            "sent_count": self._sent_count,
            "received_count": self._received_count,
            "error_count": self._error_count,
            "drafts_count": len(self._drafts),
            "auto_reply_enabled": self._auto_reply_enabled,
            "auto_reply_rules": len(self._auto_reply_rules),
        }

    def get_stats(self) -> Dict[str, Any]:
        """Return runtime statistics."""
        return {
            "initialized": self._initialized,
            "monitoring": self._monitoring,
            "sent_count": self._sent_count,
            "received_count": self._received_count,
            "error_count": self._error_count,
            "drafts_count": len(self._drafts),
            "known_uids": len(self._known_uids),
            "auto_reply_enabled": self._auto_reply_enabled,
        }
