"""performance indexes

Revision ID: 7b8d046a21ec
Revises: dd37311bf188
Create Date: 2026-06-21 00:51:32.774901

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7b8d046a21ec'
down_revision: Union[str, Sequence[str], None] = 'dd37311bf188'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Composite/lookup indexes that were previously created ad hoc at app startup
# (main.py::_ensure_perf_indexes, migration.py's OTP/user_id index lists).
# None of these are declared on the ORM models (so autogenerate can't see
# them), hence a dedicated revision rather than relying on the baseline diff.
_INDEXES = [
    ("ix_notes_user_deleted_updated", "notes", "(user_id, is_deleted, updated_at)"),
    ("ix_flashcard_sets_user_created", "flashcard_sets", "(user_id, created_at)"),
    ("ix_flashcards_set_created", "flashcards", "(set_id, created_at)"),
    ("ix_chat_sessions_user_updated", "chat_sessions", "(user_id, updated_at)"),
    ("ix_chat_messages_session_timestamp", "chat_messages", "(chat_session_id, timestamp)"),
    ("ix_notifications_user_created", "notifications", "(user_id, created_at)"),
    ("ix_point_transactions_user_created", "point_transactions", "(user_id, created_at)"),
    ("ix_daily_learning_metrics_user_date", "daily_learning_metrics", "(user_id, date)"),
    ("ix_reminders_user_completed_date", "reminders", "(user_id, is_completed, reminder_date)"),
    ("ix_context_documents_user_created", "context_documents", "(user_id, created_at)"),
    ("ix_question_sets_user_created", "question_sets", "(user_id, created_at)"),
    ("ix_activities_user_id", "activities", "(user_id)"),
    ("ix_chat_tutor_states_user_id", "chat_tutor_states", "(user_id)"),
    ("ix_uploaded_slides_user_id", "uploaded_slides", "(user_id)"),
    ("ix_solo_quizzes_user_id", "solo_quizzes", "(user_id)"),
    ("ix_folders_user_id", "folders", "(user_id)"),
    ("ix_playlists_user_id", "playlists", "(user_id)"),
    ("ix_learning_reviews_user_id", "learning_reviews", "(user_id)"),
    ("ix_roadmaps_user_id", "roadmaps", "(user_id)"),
    ("ix_learning_paths_user_id", "learning_paths", "(user_id)"),
    ("ix_friendships_user_id", "friendships", "(user_id)"),
    ("ix_friendships_friend_id", "friendships", "(friend_id)"),
    ("ix_friend_requests_sender_id", "friend_requests", "(sender_id)"),
    ("ix_friend_requests_receiver_id", "friend_requests", "(receiver_id)"),
    ("ix_student_knowledge_states_uid", "student_knowledge_states", "(user_id)"),
]

_OTP_INDEXES = [
    ("ix_password_reset_otps_email", "password_reset_otps", "(email)"),
    ("ix_password_reset_otps_user_id", "password_reset_otps", "(user_id)"),
    ("ix_registration_otps_email", "registration_otps", "(email)"),
    ("ix_registration_otps_username", "registration_otps", "(username)"),
    ("ix_account_deletion_otps_email", "account_deletion_otps", "(email)"),
    ("ix_account_deletion_otps_user_id", "account_deletion_otps", "(user_id)"),
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    for index_name, table, columns_sql in _INDEXES + _OTP_INDEXES:
        if table not in existing_tables:
            continue
        op.execute(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table} {columns_sql}")


def downgrade() -> None:
    bind = op.get_bind()
    for index_name, _table, _columns_sql in _INDEXES + _OTP_INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {index_name}")
