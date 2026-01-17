# API Rate Limits Guide

## Current Setup

Your YouTube summary feature uses **FREE AI APIs** with the following limits:

### Groq API (Primary)
- **Rate Limit**: 30 requests per minute
- **Daily Limit**: 14,400 requests per day
- **Models**: llama-3.3-70b-versatile
- **Get Key**: https://console.groq.com/keys

### Gemini API (Fallback)
- **Rate Limit**: 15 requests per minute  
- **Daily Limit**: 1,500 requests per day
- **Models**: gemini-2.0-flash-exp
- **Get Key**: https://makersuite.google.com/app/apikey

### YouTube Transcripts
- **Tool**: yt-dlp (free, unlimited)
- **No API key needed**

## Why You're Seeing Errors

The "V1 out of credits" or "429 Too Many Requests" errors happen when:

1. **Testing repeatedly** - Each YouTube video processes uses 2-4 API calls
2. **Long videos** - Videos over 12,000 words need multiple chunks (2+ calls each)
3. **Multiple users** - If others are using your app simultaneously

## Solutions

### Immediate Fix
**Wait 1-2 minutes** between processing videos. The rate limits reset every minute.

### Short-term Solutions

1. **Get fresh API keys** (both are free):
   - Groq: https://console.groq.com/keys
   - Gemini: https://makersuite.google.com/app/apikey

2. **Process shorter videos** - Under 10 minutes works best

3. **Use "summary" style instead of "detailed"** - Uses fewer tokens

### Long-term Solutions

1. **Upgrade to paid tiers**:
   - Groq Pay-as-you-go: $0.05-0.10 per 1M tokens
   - Gemini Pro: Higher rate limits

2. **Add caching** - Store processed videos to avoid re-processing

3. **Queue system** - Process videos one at a time with delays

## Current Implementation

The code now includes:
- ✅ Automatic rate limit detection
- ✅ Smart retry with exponential backoff
- ✅ Reduced chunk size to minimize API calls
- ✅ Rate limit tracking to prevent hitting limits
- ✅ Better error messages

## Monitoring

Check your API usage:
- Groq: https://console.groq.com/usage
- Gemini: https://makersuite.google.com/app/apikey

## Tips

- **Best time to use**: Early morning or late night (less traffic)
- **Optimal video length**: 5-15 minutes
- **Avoid**: Processing same video multiple times
- **Cache**: Results are cached in `backend/cache/transcripts/`
