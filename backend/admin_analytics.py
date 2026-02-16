"""
Admin Analytics API - Track user activity, tool usage, and token consumption
"""
from fastapi import HTTPException, Header, Query
from fastapi.responses import StreamingResponse
import sqlite3
import csv
import io
from datetime import datetime, timedelta
import os
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), 'brainwave_tutor.db')

def check_admin(x_user_id: Optional[str] = Header(None)):
    """Check if user is admin - accepts email or user_id"""
    # Admin emails
    ADMIN_EMAILS = ['aditya.s.lanka@gmail.com', 'cerbyl@gmail.com', 'stupendous0512@gmail.com']
    
    if x_user_id in ADMIN_EMAILS:
        return x_user_id
    
    # Admin user_id check (if numeric)
    try:
        if int(x_user_id) == 1:
            return x_user_id
    except (ValueError, TypeError):
        pass
    raise HTTPException(status_code=403, detail='Admin access required')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

async def get_analytics_overview(days: int = Query(30), user_id: str = Header(None, alias="X-User-Id")):
    """Get overall analytics overview"""
    check_admin(user_id)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        start_date = datetime.now() - timedelta(days=days)
        
        # Total users
        cursor.execute("SELECT COUNT(*) as count FROM users")
        total_users = cursor.fetchone()['count']
        
        # Active users (users with activity in date range)
        cursor.execute("""
            SELECT COUNT(DISTINCT user_id) as count 
            FROM user_activity_log 
            WHERE timestamp >= ?
        """, (start_date.isoformat(),))
        active_users = cursor.fetchone()['count']
        
        # Total tokens used
        cursor.execute("""
            SELECT SUM(tokens_used) as total 
            FROM user_activity_log 
            WHERE timestamp >= ?
        """, (start_date.isoformat(),))
        total_tokens = cursor.fetchone()['total'] or 0
        
        # Tool usage breakdown
        cursor.execute("""
            SELECT tool_name, COUNT(*) as usage_count, SUM(tokens_used) as tokens
            FROM user_activity_log 
            WHERE timestamp >= ?
            GROUP BY tool_name
            ORDER BY usage_count DESC
        """, (start_date.isoformat(),))
        tool_usage = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        
        return {
            'total_users': total_users,
            'active_users': active_users,
            'total_tokens': total_tokens,
            'tool_usage': tool_usage,
            'date_range': days
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def get_user_analytics(days: int = Query(30), user_id: str = Header(None, alias="X-User-Id")):
    """Get per-user analytics"""
    check_admin(user_id)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        start_date = datetime.now() - timedelta(days=days)
        
        cursor.execute("""
            SELECT 
                u.id,
                u.username,
                u.email,
                u.created_at,
                COUNT(DISTINCT a.id) as total_activities,
                SUM(a.tokens_used) as total_tokens,
                MAX(a.timestamp) as last_activity,
                GROUP_CONCAT(DISTINCT a.tool_name) as tools_used
            FROM users u
            LEFT JOIN user_activity_log a ON u.id = a.user_id 
                AND a.timestamp >= ?
            GROUP BY u.id
            ORDER BY total_tokens DESC
        """, (start_date.isoformat(),))
        
        users = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return {'users': users}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def get_user_detail(target_user_id: int, user_id: str = Header(None, alias="X-User-Id")):
    """Get detailed analytics for specific user"""
    check_admin(user_id)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # User info
        cursor.execute("SELECT * FROM users WHERE id = ?", (target_user_id,))
        user = dict(cursor.fetchone())
        
        # Activity log
        cursor.execute("""
            SELECT * FROM user_activity_log 
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT 1000
        """, (target_user_id,))
        activities = [dict(row) for row in cursor.fetchall()]
        
        # Tool usage summary
        cursor.execute("""
            SELECT 
                tool_name,
                COUNT(*) as usage_count,
                SUM(tokens_used) as total_tokens,
                AVG(tokens_used) as avg_tokens
            FROM user_activity_log
            WHERE user_id = ?
            GROUP BY tool_name
            ORDER BY usage_count DESC
        """, (target_user_id,))
        tool_summary = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        
        return {
            'user': user,
            'activities': activities,
            'tool_summary': tool_summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def export_analytics_csv(days: int = Query(30), user_id: str = Header(None, alias="X-User-Id")):
    """Export all analytics to CSV file"""
    check_admin(user_id)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        start_date = datetime.now() - timedelta(days=days)
        
        # Get all activity data
        cursor.execute("""
            SELECT 
                u.id as user_id,
                u.username,
                u.email,
                a.tool_name,
                a.action,
                a.tokens_used,
                a.timestamp,
                a.metadata
            FROM user_activity_log a
            JOIN users u ON a.user_id = u.id
            WHERE a.timestamp >= ?
            ORDER BY a.timestamp DESC
        """, (start_date.isoformat(),))
        
        rows = cursor.fetchall()
        conn.close()
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'User ID', 'Username', 'Email', 'Tool Name', 
            'Action', 'Tokens Used', 'Timestamp', 'Duration (seconds)', 
            'Session ID', 'Endpoint', 'Status Code'
        ])
        
        # Write data
        for row in rows:
            metadata = {}
            try:
                import json
                metadata = json.loads(row['metadata']) if row['metadata'] else {}
            except:
                pass
            
            writer.writerow([
                row['user_id'],
                row['username'],
                row['email'],
                row['tool_name'],
                row['action'],
                row['tokens_used'],
                row['timestamp'],
                metadata.get('duration_seconds', ''),
                metadata.get('session_id', ''),
                metadata.get('endpoint', ''),
                metadata.get('status_code', '')
            ])
        
        # Prepare file for download
        output.seek(0)
        
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type='text/csv',
            headers={
                'Content-Disposition': f'attachment; filename=analytics_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def export_user_csv(target_user_id: int, user_id: str = Header(None, alias="X-User-Id")):
    """Export specific user's analytics to CSV"""
    check_admin(user_id)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get user info
        cursor.execute("SELECT * FROM users WHERE id = ?", (target_user_id,))
        user = cursor.fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail='User not found')
        
        # Get activity data
        cursor.execute("""
            SELECT 
                tool_name,
                action,
                tokens_used,
                timestamp,
                metadata
            FROM user_activity_log
            WHERE user_id = ?
            ORDER BY timestamp DESC
        """, (target_user_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(['Tool Name', 'Action', 'Tokens Used', 'Timestamp', 'Duration (seconds)', 'Endpoint', 'Status Code'])
        
        # Write data
        for row in rows:
            metadata = {}
            try:
                import json
                metadata = json.loads(row['metadata']) if row['metadata'] else {}
            except:
                pass
                
            writer.writerow([
                row['tool_name'],
                row['action'],
                row['tokens_used'],
                row['timestamp'],
                metadata.get('duration_seconds', ''),
                metadata.get('endpoint', ''),
                metadata.get('status_code', '')
            ])
        
        output.seek(0)
        
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type='text/csv',
            headers={
                'Content-Disposition': f'attachment; filename=user_{user["username"]}_analytics_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Initialize database table for activity logging
def init_activity_log_table():
    """Create activity log table if it doesn't exist"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tool_name TEXT NOT NULL,
            action TEXT,
            tokens_used INTEGER DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            metadata TEXT,
            session_id TEXT,
            duration_seconds REAL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_activity_user 
        ON user_activity_log(user_id)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_activity_timestamp 
        ON user_activity_log(timestamp)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_activity_session 
        ON user_activity_log(session_id)
    """)
    
    conn.commit()
    conn.close()
