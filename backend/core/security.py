# NEXUS AI - Security Manager
"""
Security management for NEXUS AI including encryption, 
authentication, and data protection for local-first operation.
"""

import hashlib
import hmac
import os
import base64
import json
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple
from pathlib import Path
from loguru import logger

try:
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from jose import jwt, JWTError
    from passlib.context import CryptContext
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False
    logger.warning("Cryptography libraries not installed. Security features limited.")


class SecurityManager:
    """
    Handles all security operations for NEXUS AI.
    
    Features:
    - Local data encryption/decryption
    - Password hashing and verification
    - JWT token generation and validation
    - Secure key management
    - Session management
    - Audit logging
    """

    def __init__(self, secret_key: str = "nexus-dev-secret-key",
                 data_dir: str = "./data"):
        self._secret_key = secret_key
        self._data_dir = Path(data_dir)
        self._key_file = self._data_dir / ".nexus_key"
        self._fernet: Optional[Any] = None
        self._sessions: Dict[str, Dict[str, Any]] = {}

        if HAS_CRYPTO:
            self._pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            self._init_encryption_key()
        else:
            self._pwd_context = None

        logger.info("SecurityManager initialized")

    def _init_encryption_key(self):
        """Initialize or load the encryption key."""
        if not HAS_CRYPTO:
            return

        self._data_dir.mkdir(parents=True, exist_ok=True)

        if self._key_file.exists():
            with open(self._key_file, "rb") as f:
                key = f.read()
        else:
            # Derive key from secret
            salt = os.urandom(16)
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=600000,
            )
            key_bytes = kdf.derive(self._secret_key.encode())
            key = base64.urlsafe_b64encode(key_bytes)

            with open(self._key_file, "wb") as f:
                f.write(key)

            # Set restrictive permissions (Unix-like systems)
            try:
                os.chmod(self._key_file, 0o600)
            except (OSError, AttributeError):
                pass

        self._fernet = Fernet(key)

    def encrypt(self, data: str) -> str:
        """Encrypt a string value."""
        if not self._fernet:
            logger.warning("Encryption not available, returning plain text")
            return data
        return self._fernet.encrypt(data.encode()).decode()

    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt an encrypted string."""
        if not self._fernet:
            logger.warning("Decryption not available, returning as-is")
            return encrypted_data
        return self._fernet.decrypt(encrypted_data.encode()).decode()

    def encrypt_dict(self, data: Dict[str, Any]) -> str:
        """Encrypt a dictionary."""
        json_str = json.dumps(data, default=str)
        return self.encrypt(json_str)

    def decrypt_dict(self, encrypted_data: str) -> Dict[str, Any]:
        """Decrypt to a dictionary."""
        json_str = self.decrypt(encrypted_data)
        return json.loads(json_str)

    def hash_password(self, password: str) -> str:
        """Hash a password using bcrypt."""
        if self._pwd_context:
            return self._pwd_context.hash(password)
        # Fallback to hashlib
        salt = os.urandom(32)
        key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
        return base64.b64encode(salt + key).decode()

    def verify_password(self, password: str, hashed: str) -> bool:
        """Verify a password against its hash."""
        if self._pwd_context:
            return self._pwd_context.verify(password, hashed)
        # Fallback verification
        try:
            decoded = base64.b64decode(hashed)
            salt = decoded[:32]
            stored_key = decoded[32:]
            new_key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
            return hmac.compare_digest(stored_key, new_key)
        except Exception:
            return False

    def create_token(self, data: Dict[str, Any],
                     expires_delta: Optional[timedelta] = None) -> str:
        """Create a JWT token."""
        to_encode = data.copy()
        expire = datetime.utcnow() + (expires_delta or timedelta(hours=24))
        to_encode.update({"exp": expire, "iat": datetime.utcnow()})

        if HAS_CRYPTO:
            return jwt.encode(to_encode, self._secret_key, algorithm="HS256")
        else:
            # Simple token fallback
            token_data = json.dumps(to_encode, default=str)
            return base64.urlsafe_b64encode(token_data.encode()).decode()

    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify and decode a JWT token."""
        try:
            if HAS_CRYPTO:
                payload = jwt.decode(token, self._secret_key, algorithms=["HS256"])
                return payload
            else:
                decoded = base64.urlsafe_b64decode(token.encode()).decode()
                return json.loads(decoded)
        except Exception as e:
            logger.warning(f"Token verification failed: {e}")
            return None

    def create_session(self, user_id: str,
                       metadata: Optional[Dict[str, Any]] = None) -> str:
        """Create a new session."""
        session_id = secrets.token_urlsafe(32)
        self._sessions[session_id] = {
            "user_id": user_id,
            "created_at": datetime.utcnow().isoformat(),
            "last_activity": datetime.utcnow().isoformat(),
            "metadata": metadata or {},
            "active": True,
        }
        logger.info(f"Session created for user: {user_id}")
        return session_id

    def validate_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Validate a session and return its data."""
        session = self._sessions.get(session_id)
        if session and session["active"]:
            session["last_activity"] = datetime.utcnow().isoformat()
            return session
        return None

    def invalidate_session(self, session_id: str) -> bool:
        """Invalidate/end a session."""
        if session_id in self._sessions:
            self._sessions[session_id]["active"] = False
            return True
        return False

    def generate_api_key(self) -> str:
        """Generate a secure API key."""
        return secrets.token_urlsafe(48)

    def sanitize_input(self, text: str) -> str:
        """Sanitize user input to prevent injection attacks."""
        # Remove null bytes
        text = text.replace("\x00", "")
        # Basic XSS prevention
        dangerous_chars = {"<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#x27;"}
        for char, replacement in dangerous_chars.items():
            text = text.replace(char, replacement)
        return text

    def get_file_hash(self, file_path: str) -> str:
        """Calculate SHA-256 hash of a file for integrity verification."""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def secure_delete(self, file_path: str) -> bool:
        """Securely delete a file by overwriting with random data."""
        try:
            path = Path(file_path)
            if not path.exists():
                return False

            file_size = path.stat().st_size
            # Overwrite with random data 3 times
            for _ in range(3):
                with open(file_path, "wb") as f:
                    f.write(os.urandom(file_size))
            path.unlink()
            logger.info(f"Securely deleted: {file_path}")
            return True
        except Exception as e:
            logger.error(f"Secure delete failed for {file_path}: {e}")
            return False

    def get_security_status(self) -> Dict[str, Any]:
        """Get current security status."""
        return {
            "encryption_available": HAS_CRYPTO,
            "encryption_key_exists": self._key_file.exists() if self._key_file else False,
            "active_sessions": sum(1 for s in self._sessions.values() if s["active"]),
            "total_sessions": len(self._sessions),
        }
