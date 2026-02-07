"""
Script to unlock all locked nodes using raw SQL
"""
import sqlite3

def unlock_all_nodes():
    conn = sqlite3.connect('backend/brainwave_tutor.db')
    cursor = conn.cursor()
    
    try:
        # Count locked nodes
        cursor.execute("SELECT COUNT(*) FROM learning_node_progress WHERE status = 'locked'")
        count = cursor.fetchone()[0]
        print(f"Found {count} locked nodes")
        
        # Unlock all locked nodes
        cursor.execute("UPDATE learning_node_progress SET status = 'unlocked' WHERE status = 'locked'")
        
        conn.commit()
        print(f"✅ Successfully unlocked {cursor.rowcount} nodes!")
        
        # Verify
        cursor.execute("SELECT COUNT(*) FROM learning_node_progress WHERE status = 'locked'")
        remaining = cursor.fetchone()[0]
        print(f"Remaining locked nodes: {remaining}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    unlock_all_nodes()
