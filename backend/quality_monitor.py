"""
AI Response Quality Monitoring System
Tracks performance metrics and identifies issues
"""
import logging
import time
from typing import Dict, Any, List, Optional
from collections import defaultdict, deque
from datetime import datetime, timedelta
import statistics

logger = logging.getLogger(__name__)


class ResponseQualityMonitor:
    """Monitor and track AI response quality metrics"""
    
    def __init__(self, window_size: int = 100):
        self.window_size = window_size
        
        # Metrics storage (rolling window)
        self.latencies = deque(maxlen=window_size)
        self.token_counts = deque(maxlen=window_size)
        self.response_lengths = deque(maxlen=window_size)
        self.error_counts = deque(maxlen=window_size)
        
        # Detailed logs
        self.slow_queries: List[Dict[str, Any]] = []
        self.high_token_queries: List[Dict[str, Any]] = []
        self.error_log: List[Dict[str, Any]] = []
        
        # Thresholds
        self.latency_threshold_ms = 5000
        self.token_threshold = 3000
        self.max_log_entries = 50
        
        # Aggregated stats
        self.total_requests = 0
        self.total_errors = 0
        self.start_time = time.time()
    
    def log_response(
        self,
        query: str,
        response: str,
        latency_ms: float,
        tokens_used: int,
        success: bool = True,
        error: Optional[str] = None,
        agent_type: str = "unknown"
    ):
        """Log a response and its metrics"""
        self.total_requests += 1
        
        # Add to rolling windows
        self.latencies.append(latency_ms)
        self.token_counts.append(tokens_used)
        self.response_lengths.append(len(response))
        self.error_counts.append(0 if success else 1)
        
        if not success:
            self.total_errors += 1
        
        # Check for issues
        timestamp = datetime.utcnow().isoformat()
        
        if latency_ms > self.latency_threshold_ms:
            entry = {
                "timestamp": timestamp,
                "query": query[:100],
                "latency_ms": latency_ms,
                "agent_type": agent_type
            }
            self.slow_queries.append(entry)
            if len(self.slow_queries) > self.max_log_entries:
                self.slow_queries.pop(0)
            
            logger.warning(f"⚠️ Slow response: {latency_ms:.0f}ms for {agent_type} query: {query[:50]}")
        
        if tokens_used > self.token_threshold:
            entry = {
                "timestamp": timestamp,
                "query": query[:100],
                "tokens": tokens_used,
                "agent_type": agent_type
            }
            self.high_token_queries.append(entry)
            if len(self.high_token_queries) > self.max_log_entries:
                self.high_token_queries.pop(0)
            
            logger.warning(f"⚠️ High token usage: {tokens_used} tokens for {agent_type}")
        
        if not success and error:
            entry = {
                "timestamp": timestamp,
                "query": query[:100],
                "error": error,
                "agent_type": agent_type
            }
            self.error_log.append(entry)
            if len(self.error_log) > self.max_log_entries:
                self.error_log.pop(0)
            
            logger.error(f"❌ Error in {agent_type}: {error}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive statistics"""
        if not self.latencies:
            return {
                "status": "no_data",
                "total_requests": self.total_requests
            }
        
        # Calculate statistics
        avg_latency = statistics.mean(self.latencies)
        p50_latency = statistics.median(self.latencies)
        p95_latency = self._percentile(list(self.latencies), 95)
        p99_latency = self._percentile(list(self.latencies), 99)
        
        avg_tokens = statistics.mean(self.token_counts)
        avg_response_length = statistics.mean(self.response_lengths)
        
        error_rate = sum(self.error_counts) / len(self.error_counts) if self.error_counts else 0
        
        uptime_hours = (time.time() - self.start_time) / 3600
        requests_per_hour = self.total_requests / uptime_hours if uptime_hours > 0 else 0
        
        return {
            "status": "healthy" if error_rate < 0.05 and avg_latency < 3000 else "degraded",
            "total_requests": self.total_requests,
            "total_errors": self.total_errors,
            "error_rate_percent": round(error_rate * 100, 2),
            "uptime_hours": round(uptime_hours, 2),
            "requests_per_hour": round(requests_per_hour, 2),
            "latency": {
                "avg_ms": round(avg_latency, 2),
                "p50_ms": round(p50_latency, 2),
                "p95_ms": round(p95_latency, 2),
                "p99_ms": round(p99_latency, 2)
            },
            "tokens": {
                "avg_per_request": round(avg_tokens, 2),
                "total_estimated": round(avg_tokens * self.total_requests, 0)
            },
            "response": {
                "avg_length_chars": round(avg_response_length, 2)
            },
            "issues": {
                "slow_queries_count": len(self.slow_queries),
                "high_token_queries_count": len(self.high_token_queries),
                "recent_errors_count": len(self.error_log)
            }
        }
    
    def get_recent_issues(self) -> Dict[str, List[Dict]]:
        """Get recent performance issues"""
        return {
            "slow_queries": self.slow_queries[-10:],
            "high_token_queries": self.high_token_queries[-10:],
            "errors": self.error_log[-10:]
        }
    
    def _percentile(self, data: List[float], percentile: int) -> float:
        """Calculate percentile"""
        if not data:
            return 0.0
        sorted_data = sorted(data)
        index = int(len(sorted_data) * percentile / 100)
        return sorted_data[min(index, len(sorted_data) - 1)]
    
    def reset(self):
        """Reset all metrics"""
        self.latencies.clear()
        self.token_counts.clear()
        self.response_lengths.clear()
        self.error_counts.clear()
        self.slow_queries.clear()
        self.high_token_queries.clear()
        self.error_log.clear()
        self.total_requests = 0
        self.total_errors = 0
        self.start_time = time.time()
        logger.info("Quality monitor reset")


class AgentPerformanceTracker:
    """Track performance per agent type"""
    
    def __init__(self):
        self.agent_monitors: Dict[str, ResponseQualityMonitor] = defaultdict(
            lambda: ResponseQualityMonitor(window_size=50)
        )
    
    def log_agent_response(
        self,
        agent_type: str,
        query: str,
        response: str,
        latency_ms: float,
        tokens_used: int,
        success: bool = True,
        error: Optional[str] = None
    ):
        """Log response for specific agent"""
        monitor = self.agent_monitors[agent_type]
        monitor.log_response(query, response, latency_ms, tokens_used, success, error, agent_type)
    
    def get_agent_stats(self, agent_type: str) -> Dict[str, Any]:
        """Get stats for specific agent"""
        if agent_type not in self.agent_monitors:
            return {"status": "no_data"}
        return self.agent_monitors[agent_type].get_stats()
    
    def get_all_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get stats for all agents"""
        return {
            agent_type: monitor.get_stats()
            for agent_type, monitor in self.agent_monitors.items()
        }
    
    def get_summary(self) -> Dict[str, Any]:
        """Get overall summary across all agents"""
        all_stats = self.get_all_stats()
        
        if not all_stats:
            return {"status": "no_data"}
        
        total_requests = sum(s.get("total_requests", 0) for s in all_stats.values())
        total_errors = sum(s.get("total_errors", 0) for s in all_stats.values())
        
        avg_latencies = [
            s["latency"]["avg_ms"] 
            for s in all_stats.values() 
            if "latency" in s
        ]
        
        return {
            "total_requests": total_requests,
            "total_errors": total_errors,
            "error_rate_percent": round(total_errors / total_requests * 100, 2) if total_requests > 0 else 0,
            "avg_latency_ms": round(statistics.mean(avg_latencies), 2) if avg_latencies else 0,
            "agents_tracked": len(all_stats),
            "per_agent": all_stats
        }


# Global instances
_quality_monitor: Optional[ResponseQualityMonitor] = None
_agent_tracker: Optional[AgentPerformanceTracker] = None


def get_quality_monitor() -> ResponseQualityMonitor:
    """Get global quality monitor instance"""
    global _quality_monitor
    if _quality_monitor is None:
        _quality_monitor = ResponseQualityMonitor()
    return _quality_monitor


def get_agent_tracker() -> AgentPerformanceTracker:
    """Get global agent performance tracker"""
    global _agent_tracker
    if _agent_tracker is None:
        _agent_tracker = AgentPerformanceTracker()
    return _agent_tracker
