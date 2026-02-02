"""
API Response Caching Middleware
Caches GET requests to reduce server load
"""
import logging
import json
from typing import Callable
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

logger = logging.getLogger(__name__)

try:
    from caching import get_cache_manager
    CACHE_AVAILABLE = True
except ImportError:
    CACHE_AVAILABLE = False


class APICacheMiddleware(BaseHTTPMiddleware):
    """
    Middleware for caching API responses
    Only caches GET requests
    """
    
    def __init__(
        self,
        app: ASGIApp,
        default_ttl: int = 60,
        cache_paths: list = None,
        exclude_paths: list = None
    ):
        super().__init__(app)
        self.default_ttl = default_ttl
        self.cache_paths = cache_paths or []
        self.exclude_paths = exclude_paths or [
            "/api/auth",
            "/api/login",
            "/api/register",
            "/api/chat/send",
            "/api/flashcards/review"
        ]
        self.cache_manager = get_cache_manager() if CACHE_AVAILABLE else None
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Only cache GET requests
        if request.method != "GET":
            return await call_next(request)
        
        # Check if path should be cached
        path = request.url.path
        if not self._should_cache(path):
            return await call_next(request)
        
        # Check if cache is available
        if not self.cache_manager:
            return await call_next(request)
        
        # Generate cache key
        cache_key = self._generate_cache_key(request)
        
        # Try to get from cache
        cached_response = self.cache_manager.get_api_response(path, cache_key)
        if cached_response:
            logger.debug(f"API cache hit: {path}")
            return JSONResponse(
                content=cached_response["content"],
                status_code=cached_response["status_code"],
                headers={"X-Cache": "HIT"}
            )
        
        # Execute request
        response = await call_next(request)
        
        # Cache successful responses
        if response.status_code == 200:
            # Read response body
            body = b""
            async for chunk in response.body_iterator:
                body += chunk
            
            try:
                content = json.loads(body.decode())
                
                # Cache the response
                ttl = self._get_ttl_for_path(path)
                self.cache_manager.set_api_response(
                    path,
                    {
                        "content": content,
                        "status_code": response.status_code
                    },
                    ttl,
                    cache_key
                )
                
                logger.debug(f"API response cached: {path}")
                
                # Return response with cache miss header
                return JSONResponse(
                    content=content,
                    status_code=response.status_code,
                    headers={"X-Cache": "MISS"}
                )
            except:
                # If can't parse JSON, return original response
                return Response(
                    content=body,
                    status_code=response.status_code,
                    headers=dict(response.headers)
                )
        
        return response
    
    def _should_cache(self, path: str) -> bool:
        """Check if path should be cached"""
        # Exclude certain paths
        for exclude in self.exclude_paths:
            if path.startswith(exclude):
                return False
        
        # If cache_paths is specified, only cache those
        if self.cache_paths:
            for cache_path in self.cache_paths:
                if path.startswith(cache_path):
                    return True
            return False
        
        # Cache all GET requests by default
        return True
    
    def _generate_cache_key(self, request: Request) -> str:
        """Generate cache key from request"""
        # Include query parameters in cache key
        query_params = str(request.query_params)
        user_id = request.headers.get("X-User-ID", "anonymous")
        return f"{user_id}:{query_params}"
    
    def _get_ttl_for_path(self, path: str) -> int:
        """Get TTL based on path"""
        # Different TTLs for different endpoints
        ttl_map = {
            "/api/user/profile": 600,  # 10 minutes
            "/api/flashcards": 300,    # 5 minutes
            "/api/notes": 180,         # 3 minutes
            "/api/stats": 300,         # 5 minutes
            "/api/analytics": 600,     # 10 minutes
            "/api/leaderboard": 120,   # 2 minutes
        }
        
        for prefix, ttl in ttl_map.items():
            if path.startswith(prefix):
                return ttl
        
        return self.default_ttl


def add_cache_headers(ttl: int = 60):
    """
    Decorator to add cache control headers to responses
    
    Usage:
        @app.get("/api/data")
        @add_cache_headers(ttl=300)
        async def get_data():
            return {"data": "..."}
    """
    def decorator(func: Callable):
        async def wrapper(*args, **kwargs):
            response = await func(*args, **kwargs)
            
            if isinstance(response, dict):
                response = JSONResponse(content=response)
            
            response.headers["Cache-Control"] = f"public, max-age={ttl}"
            return response
        
        return wrapper
    return decorator


# ==================== Cache Invalidation Helpers ====================

def invalidate_api_cache(path_prefix: str):
    """
    Invalidate all cached responses for a path prefix
    
    Usage:
        invalidate_api_cache("/api/notes")
    """
    if CACHE_AVAILABLE:
        cache_manager = get_cache_manager()
        # Clear API response cache for this prefix
        # Note: This clears all API cache - could be optimized
        cache_manager.api_response_cache.clear()
        logger.info(f"Invalidated API cache for {path_prefix}")


def invalidate_user_api_cache(user_id: int):
    """Invalidate all cached API responses for a user"""
    if CACHE_AVAILABLE:
        # For now, clear all API cache
        # Could be optimized to only clear user-specific entries
        cache_manager = get_cache_manager()
        cache_manager.api_response_cache.clear()
        logger.info(f"Invalidated API cache for user {user_id}")
