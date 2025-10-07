# 🌤️ Kaiu Weather Popup Feature Implementation Plan

## Feature Overview
A fun, Estonian-language weather popup for Kaiu Kodukant website that displays AI-generated weather blurbs, maintaining consistency through context and providing localized, engaging weather reports.

## Technical Architecture

### 1. Backend Components (Node.js API)
- **New route**: `/api/v1/weather` - Serves latest blurb and handles weather data
- **Weather service**: Fetches from Estonian Weather Service API (no key required)
- **AI blurb generator**: Uses OpenAI GPT-4o-mini (most cost-effective) with Estonian prompts
- **SQLite tables**:
  - `weather_blurbs` - Stores 20 latest blurbs with timestamps
  - `weather_cache` - Caches weather API responses (1-hour TTL)
- **Scheduled job**: Cron job every 4 hours to generate new blurbs
- **Configuration**: Add OpenAI API key to environment variables

### 2. Frontend Components (JavaScript/HTML/CSS)
- **Weather popup module** (`js/weather-popup.js`):
  - Fetches latest blurb from API
  - Handles popup display/animation
  - Manages local storage for "last seen" tracking
- **Popup design**:
  - Glassmorphism effect matching site aesthetics
  - Colors: Silk background, Sirocco text, Cinnamon accents
  - Animated weather icons (CSS/SVG)
  - 300x200px compact size, positioned bottom-right
- **Easter egg trigger**: Small weather icon (☀️) in footer that changes based on actual weather

### 3. Data Flow
```
Estonian Weather API → Backend fetches → AI generates blurb → Store in SQLite
                                              ↓
Browser ← API serves latest blurb ← Retrieve from database
```

## Implementation Steps

### Phase 1: Backend Infrastructure
1. Create weather database tables in SQLite
2. Implement weather fetcher service (port Python to JS)
3. Set up OpenAI integration for blurb generation
4. Create weather API routes
5. Add cron job for 4-hour updates

### Phase 2: Frontend Implementation
1. Design popup component with Tailwind classes
2. Create weather-popup.js module
3. Add Easter egg trigger to footer
4. Implement smooth animations and transitions
5. Add local storage for user preferences

### Phase 3: AI & Content
1. Configure Estonian prompt system
2. Test blurb generation with weather context
3. Fine-tune temperature (0.7) for creativity
4. Implement 20-blurb context window
5. Add variety checks to prevent repetition

## Key Features
- **Location**: Kaiu, Raplamaa (59.0106;25.0597)
- **Language**: Estonian only
- **Update frequency**: Every 4 hours
- **Blurb style**: Warm, conversational, 60-120 words
- **Context preservation**: 20 latest blurbs for consistency
- **Cost optimization**: GPT-4o-mini (~$0.01/day estimated)
- **Easter egg**: Weather icon in footer changes with conditions

## Easter Egg Trigger Options

### Recommended: Weather Icon in Footer
- **Location**: Footer component, next to location info
- **Behavior**: Small weather icon (☀️/☁️/🌧️) that reflects current weather
- **Activation**: Click to open weather popup
- **Why**: Subtle, always visible, naturally integrated

### Alternative Ideas
1. **Click on "Kaiu" in stats** - Homepage location stat becomes clickable
2. **Hover hero image** - 3-second hover triggers popup
3. **Konami code** - Fun but less discoverable
4. **Hidden cloud in header** - Animated cloud that floats occasionally

## Database Schema

```sql
-- Weather blurbs table
CREATE TABLE weather_blurbs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  blurb_text TEXT NOT NULL,
  weather_data JSON,
  temperature REAL,
  conditions TEXT,
  wind_speed REAL,
  wind_direction TEXT,
  precipitation REAL
);

-- Weather cache table
CREATE TABLE weather_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  location TEXT,
  forecast_json JSON,
  expires_at DATETIME
);

-- Index for efficient queries
CREATE INDEX idx_blurbs_created ON weather_blurbs(created_at DESC);
CREATE INDEX idx_cache_expires ON weather_cache(expires_at);
```

## API Endpoints

### GET `/api/v1/weather/current`
Returns the latest weather blurb and current conditions
```json
{
  "blurb": "Tänane päev Kaius...",
  "temperature": 8.5,
  "conditions": "Vahelduv pilvisus",
  "icon": "partly-cloudy",
  "timestamp": "2025-10-07T12:00:00Z"
}
```

### GET `/api/v1/weather/history`
Returns last 5 blurbs for popup history view
```json
{
  "blurbs": [...]
}
```

### POST `/api/v1/weather/generate` (Admin only)
Manually trigger blurb generation

## Frontend Integration

### Popup Component Structure
```html
<div id="weather-popup" class="weather-popup">
  <div class="weather-header">
    <span class="weather-icon">☀️</span>
    <span class="weather-temp">8°C</span>
    <button class="close-btn">×</button>
  </div>
  <div class="weather-blurb">
    <!-- Estonian weather blurb text -->
  </div>
  <div class="weather-footer">
    <span class="location">Kaiu, Raplamaa</span>
    <span class="timestamp">4 tundi tagasi</span>
  </div>
</div>
```

### CSS Styling (Tailwind + Custom)
- Glassmorphism: `backdrop-blur-md bg-white/80`
- Smooth animations: `transition-all duration-300`
- Color scheme: Silk, Sirocco, Cinnamon from existing palette
- Responsive positioning

## Environment Variables
```env
# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=200

# Weather Configuration
WEATHER_UPDATE_INTERVAL=14400  # 4 hours in seconds
WEATHER_LOCATION_COORDS=59.0106;25.0597
WEATHER_LOCATION_NAME=Kaiu, Raplamaa
```

## Cron Job Configuration
```javascript
// Run every 4 hours: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00
const schedule = '0 */4 * * *';
```

## Cost Analysis

### OpenAI API Costs (GPT-4o-mini)
- Input: ~500 tokens per request × 6 requests/day = 3,000 tokens/day
- Output: ~150 tokens per request × 6 requests/day = 900 tokens/day
- Daily cost: (3,000 × $0.00015 + 900 × $0.0006) / 1000 = ~$0.001
- **Monthly: ~$0.03**

### Estonian Weather API
- **Cost**: Free (public service)
- **Rate limits**: None documented
- **Reliability**: Government service, very reliable

### Total Estimated Cost
- **Monthly**: ~$0.03 (essentially free)
- **Yearly**: ~$0.36

## Testing Strategy

### Backend Testing
1. Weather API integration test
2. OpenAI prompt generation test
3. Database operations test
4. Cron job scheduling test
5. API endpoint response test

### Frontend Testing
1. Popup display/animation test
2. Easter egg trigger test
3. Local storage persistence test
4. Mobile responsiveness test
5. Cross-browser compatibility test

## Deployment Checklist

- [ ] Add OpenAI API key to production environment
- [ ] Run database migrations
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Test cron job execution
- [ ] Verify popup display
- [ ] Monitor first 24 hours of blurb generation
- [ ] Check API usage and costs

## Timeline

### Day 1 (Backend - 3 hours)
- [ ] Database setup
- [ ] Weather service implementation
- [ ] OpenAI integration
- [ ] API routes

### Day 2 (Frontend - 3 hours)
- [ ] Popup component
- [ ] JavaScript module
- [ ] Easter egg integration
- [ ] Animations

### Day 3 (Polish - 2 hours)
- [ ] Testing
- [ ] Fine-tuning
- [ ] Documentation
- [ ] Deployment

**Total estimated time**: 8 hours

## Success Metrics
- Blurbs generated successfully every 4 hours
- Popup loads within 500ms
- User engagement with Easter egg > 5%
- Zero API errors in first week
- Cost stays under $0.05/month

## Potential Enhancements (Future)
1. Weather trend analysis in blurbs
2. Seasonal themes for popup design
3. User preferences (dismiss duration)
4. Historical weather comparisons
5. Share blurb on social media
6. Multiple language support