# NEXUS AI - Chat API Routes
"""
Chat endpoints for conversational interaction with NEXUS AI.
Handles message processing, conversation management, and chat history.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_db
from database.repositories import ConversationRepository, UserRepository
from agents.base_agent import AgentContext, AgentResponse
from api.dependencies import get_engine, get_current_user_id


# ============================================================
# Request / Response Models
# ============================================================

class ChatMessageRequest(BaseModel):
    """Request body for sending a chat message."""
    message: str = Field(..., min_length=1, max_length=10000, description="User message text")
    conversation_id: Optional[str] = Field(None, description="Existing conversation ID to continue")
    agent: Optional[str] = Field(None, description="Target agent name (auto-routed if omitted)")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Extra metadata")
    attachments: Optional[List[str]] = Field(default_factory=list, description="File attachment paths")


class ChatMessageResponse(BaseModel):
    """Response from the AI after processing a message."""
    message_id: str
    conversation_id: str
    content: str
    agent_name: str
    confidence: float = 1.0
    suggestions: List[str] = []
    actions: List[Dict[str, Any]] = []
    processing_time_ms: float = 0.0
    metadata: Dict[str, Any] = {}
    timestamp: str


class ConversationSummary(BaseModel):
    """Summary of a conversation."""
    id: str
    title: Optional[str] = None
    agent_type: str = "personal"
    message_count: int = 0
    is_active: bool = True
    created_at: str
    updated_at: str


class ConversationDetail(BaseModel):
    """Full conversation with messages."""
    id: str
    title: Optional[str] = None
    agent_type: str = "personal"
    message_count: int = 0
    messages: List[Dict[str, Any]] = []
    created_at: str
    updated_at: str


class ChatHistoryResponse(BaseModel):
    """Paginated chat history response."""
    conversation_id: str
    messages: List[Dict[str, Any]]
    total: int
    has_more: bool


class DeleteConversationResponse(BaseModel):
    """Response after deleting a conversation."""
    success: bool
    conversation_id: str
    message: str


# ============================================================
# Router
# ============================================================

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.post(
    "",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Send a message to NEXUS AI",
    description="Send a message that will be routed to the appropriate agent via the orchestrator.",
)
async def send_message(
    request: ChatMessageRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    engine=Depends(get_engine),
):
    """Process a user message through the NEXUS AI orchestrator."""
    try:
        conv_repo = ConversationRepository(db)

        # Get or create conversation
        if request.conversation_id:
            conversation = await conv_repo.get_conversation(request.conversation_id)
            if not conversation:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Conversation {request.conversation_id} not found",
                )
        else:
            # Create new conversation
            title = request.message[:80] + ("..." if len(request.message) > 80 else "")
            agent_type = request.agent or "personal"
            conversation = await conv_repo.create_conversation(
                user_id=user_id,
                title=title,
                agent_type=agent_type,
            )

        # Save user message
        user_msg = await conv_repo.add_message(
            conversation_id=conversation.id,
            role="user",
            content=request.message,
            metadata=request.metadata,
        )

        # Build conversation history for context
        recent_messages = await conv_repo.get_recent_messages(conversation.id, limit=20)
        history = [
            {"role": m.role, "content": m.content}
            for m in recent_messages
            if m.id != user_msg.id
        ]

        # Build agent context
        context = AgentContext(
            user_id=user_id,
            conversation_id=conversation.id,
            message=request.message,
            history=history,
            metadata=request.metadata or {},
            attachments=request.attachments or [],
        )

        # Route through orchestrator
        orchestrator = engine.get_agent("orchestrator")
        if orchestrator:
            agent_response: AgentResponse = await orchestrator.handle_message(context)
        elif request.agent and engine.get_agent(request.agent):
            target = engine.get_agent(request.agent)
            agent_response = await target.handle_message(context)
        else:
            # Fallback when no orchestrator is initialized
            agent_response = AgentResponse(
                content="NEXUS AI is initializing. Please try again shortly.",
                agent_name="system",
                confidence=1.0,
            )

        # Save assistant response
        assistant_msg = await conv_repo.add_message(
            conversation_id=conversation.id,
            role="assistant",
            content=agent_response.content,
            agent_name=agent_response.agent_name,
            metadata=agent_response.metadata,
            tokens_used=agent_response.tokens_used,
            processing_time_ms=agent_response.processing_time_ms,
        )

        return ChatMessageResponse(
            message_id=assistant_msg.id,
            conversation_id=conversation.id,
            content=agent_response.content,
            agent_name=agent_response.agent_name,
            confidence=agent_response.confidence,
            suggestions=agent_response.suggestions,
            actions=agent_response.actions,
            processing_time_ms=agent_response.processing_time_ms,
            metadata=agent_response.metadata,
            timestamp=datetime.utcnow().isoformat(),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing message: {str(e)}",
        )


@router.get(
    "/history",
    response_model=ChatHistoryResponse,
    summary="Get chat history for a conversation",
)
async def get_chat_history(
    conversation_id: str = Query(..., description="Conversation ID"),
    limit: int = Query(50, ge=1, le=500, description="Maximum messages to return"),
    offset: int = Query(0, ge=0, description="Message offset for pagination"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Retrieve message history for a specific conversation."""
    try:
        conv_repo = ConversationRepository(db)
        conversation = await conv_repo.get_conversation(conversation_id)

        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation {conversation_id} not found",
            )

        messages = await conv_repo.get_messages(conversation_id, limit=limit + 1)

        # Apply offset
        paginated = messages[offset : offset + limit + 1]
        has_more = len(paginated) > limit
        paginated = paginated[:limit]

        message_list = [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "agent_name": m.agent_name,
                "metadata": m.metadata or {},
                "tokens_used": m.tokens_used,
                "processing_time_ms": m.processing_time_ms,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in paginated
        ]

        return ChatHistoryResponse(
            conversation_id=conversation_id,
            messages=message_list,
            total=conversation.message_count or len(message_list),
            has_more=has_more,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching chat history: {str(e)}",
        )


@router.get(
    "/conversations",
    response_model=List[ConversationSummary],
    summary="List all conversations",
)
async def list_conversations(
    limit: int = Query(50, ge=1, le=200, description="Maximum conversations to return"),
    agent_type: Optional[str] = Query(None, description="Filter by agent type"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """List all conversations for the current user."""
    try:
        conv_repo = ConversationRepository(db)
        conversations = await conv_repo.get_user_conversations(
            user_id=user_id,
            limit=limit,
            agent_type=agent_type,
        )

        return [
            ConversationSummary(
                id=c.id,
                title=c.title,
                agent_type=c.agent_type,
                message_count=c.message_count or 0,
                is_active=c.is_active,
                created_at=c.created_at.isoformat() if c.created_at else "",
                updated_at=c.updated_at.isoformat() if c.updated_at else "",
            )
            for c in conversations
        ]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing conversations: {str(e)}",
        )


@router.delete(
    "/conversations/{conversation_id}",
    response_model=DeleteConversationResponse,
    summary="Delete a conversation",
)
async def delete_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Delete a conversation and all its messages."""
    try:
        conv_repo = ConversationRepository(db)
        conversation = await conv_repo.get_conversation(conversation_id)

        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation {conversation_id} not found",
            )

        deleted = await conv_repo._delete(type(conversation), conversation_id)

        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete conversation",
            )

        return DeleteConversationResponse(
            success=True,
            conversation_id=conversation_id,
            message="Conversation deleted successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting conversation: {str(e)}",
        )
