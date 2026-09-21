"""Persist reminder occurrences, UTC schedule and notification targets."""
from alembic import op
import sqlalchemy as sa
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
revision = 'c3b20260922'
down_revision = 'b2b20260911a'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('notification_push_subscriptions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('endpoint_hash', sa.String(64), unique=True, nullable=False),
        sa.Column('platform', sa.String(10), nullable=False),
        sa.Column('subscription', sa.Text(), nullable=False),
        sa.Column('last_notification_id', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('failures', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('retry_at', sa.DateTime(), nullable=True),
        sa.Column('receipt_id', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True))
    op.create_table('notification_push_deliveries',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('subscription_id', sa.Integer(), sa.ForeignKey('notification_push_subscriptions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('notification_id', sa.Integer(), sa.ForeignKey('notifications.id', ondelete='CASCADE'), nullable=False),
        sa.Column('delivered_at', sa.DateTime()),
        sa.UniqueConstraint('subscription_id', 'notification_id', name='uq_push_delivery'))
    op.create_index('ix_notification_push_subscriptions_user_id', 'notification_push_subscriptions', ['user_id'])
    with op.batch_alter_table('notifications') as b:
        b.add_column(sa.Column('source_id', sa.Integer(), nullable=True))
        b.add_column(sa.Column('occurrence_key', sa.String(160), nullable=True))
        b.add_column(sa.Column('due_at', sa.DateTime(), nullable=True))
        b.add_column(sa.Column('action_url', sa.String(500), nullable=True))
        b.add_column(sa.Column('cancelled', sa.Boolean(), nullable=False, server_default=sa.false()))
        b.create_index('ix_notifications_source_id', ['source_id'])
        b.create_unique_constraint('uq_notifications_occurrence_key', ['occurrence_key'])
        b.create_index('ix_notifications_inbox', ['user_id', 'cancelled', 'created_at', 'id'])
    with op.batch_alter_table('reminders') as b:
        b.add_column(sa.Column('timezone_name', sa.String(64), nullable=True))
        b.add_column(sa.Column('due_at_utc', sa.DateTime(), nullable=True))
        b.add_column(sa.Column('notify_at_utc', sa.DateTime(), nullable=True))
        b.create_index('ix_reminders_notify_at_utc', ['notify_at_utc'])
    connection = op.get_bind()
    # Old rows lack a timezone. Use the user's saved zone when available; otherwise
    # leave unscheduled until that user's first client read provides an offset.
    tables = sa.inspect(connection).get_table_names()
    zones = {}
    if 'user_gamification_stats' in tables:
        zones = dict(connection.execute(sa.text('SELECT user_id, timezone_name FROM user_gamification_stats')).all())
    reminders = sa.Table('reminders', sa.MetaData(), autoload_with=connection)
    for row in connection.execute(sa.select(reminders)).mappings():
        zone = zones.get(row['user_id'])
        if not zone or zone == 'UTC' or not row['reminder_date']:
            continue
        try:
            due = row['reminder_date'].replace(tzinfo=ZoneInfo(zone)).astimezone(timezone.utc).replace(tzinfo=None)
        except (ValueError, KeyError):
            continue
        connection.execute(reminders.update().where(reminders.c.id == row['id']).values(timezone_name=zone, due_at_utc=due, notify_at_utc=due-timedelta(minutes=row['notify_before_minutes'] if row['notify_before_minutes'] is not None else 15)))
    # Link old marker notifications to occurrences, retaining the existing read state.
    import re
    notifications = sa.Table('notifications', sa.MetaData(), autoload_with=connection)
    used = set()
    for row in connection.execute(sa.select(notifications).order_by(notifications.c.id.desc())).mappings():
        marker = re.search(r'\[reminder_id:(\d+)\]', row['message'] or '')
        if not marker:
            continue
        reminder = connection.execute(sa.select(reminders).where(reminders.c.id == int(marker[1]), reminders.c.user_id == row['user_id'])).mappings().first()
        if not reminder:
            connection.execute(notifications.update().where(notifications.c.id == row['id']).values(cancelled=True, is_read=True))
            continue
        due = reminder['due_at_utc']
        key = f'reminder:{reminder["id"]}:{due.isoformat()}Z' if due else None
        cancelled = reminder['is_completed'] or (key in used if key else False)
        connection.execute(notifications.update().where(notifications.c.id == row['id']).values(source_id=reminder['id'], due_at=due, occurrence_key=key if key not in used else None, cancelled=cancelled, action_url=f'/activity-timeline?reminder={reminder["id"]}'))
        if key: used.add(key)

def downgrade():
    op.drop_table("notification_push_deliveries")
    op.drop_table("notification_push_subscriptions")
    with op.batch_alter_table('notifications') as b:
        b.drop_index('ix_notifications_inbox')
        b.drop_index('ix_notifications_source_id')
        b.drop_constraint('uq_notifications_occurrence_key', type_='unique')
        for column in ['source_id','occurrence_key','due_at','action_url','cancelled']: b.drop_column(column)
    with op.batch_alter_table('reminders') as b:
        b.drop_index('ix_reminders_notify_at_utc')
        for column in ['timezone_name','due_at_utc','notify_at_utc']: b.drop_column(column)
