from datetime import datetime
from pathlib import Path
import importlib.util
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

def test_upgrade_preserves_rows_links_occurrences_and_downgrade():
    engine=sa.create_engine('sqlite://')
    with engine.begin() as c:
        c.execute(sa.text('CREATE TABLE users (id INTEGER PRIMARY KEY)'))
        c.execute(sa.text('CREATE TABLE user_gamification_stats (user_id INTEGER, timezone_name VARCHAR(64))'))
        c.execute(sa.text('CREATE TABLE reminders (id INTEGER PRIMARY KEY, user_id INTEGER, reminder_date DATETIME, notify_before_minutes INTEGER, is_completed BOOLEAN)'))
        c.execute(sa.text('CREATE TABLE notifications (id INTEGER PRIMARY KEY, user_id INTEGER, title VARCHAR(200), message TEXT, notification_type VARCHAR(50), is_read BOOLEAN, created_at DATETIME)'))
        c.execute(sa.text("INSERT INTO users VALUES (1)"))
        c.execute(sa.text("INSERT INTO user_gamification_stats VALUES (1, 'Asia/Kolkata')"))
        c.execute(sa.text("INSERT INTO reminders VALUES (1,1,'2026-09-22 12:00:00',15,0)"))
        c.execute(sa.text("INSERT INTO notifications VALUES (1,1,'Reminder','Example [reminder_id:1]','reminder',0,'2026-09-22 06:15:00')"))
        path=Path(__file__).resolve().parents[1]/'alembic/versions/c3b20260922_notifications.py'
        spec=importlib.util.spec_from_file_location('migration',path);migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
        with Operations.context(MigrationContext.configure(c)):
            migration.upgrade()
        row=c.execute(sa.text('SELECT due_at_utc, notify_at_utc, timezone_name FROM reminders')).first()
        assert str(row[0]).startswith('2026-09-22 06:30') and str(row[1]).startswith('2026-09-22 06:15')
        row=c.execute(sa.text('SELECT source_id, occurrence_key, is_read, cancelled FROM notifications')).first()
        assert row[0]==1 and row[1].endswith('06:30:00Z') and not row[2] and not row[3]
        assert 'notification_push_subscriptions' in sa.inspect(c).get_table_names()
        with Operations.context(MigrationContext.configure(c)):
            migration.downgrade()
        assert c.execute(sa.text('SELECT title FROM notifications')).scalar()=='Reminder'
        assert 'due_at_utc' not in {column['name'] for column in sa.inspect(c).get_columns('reminders')}
