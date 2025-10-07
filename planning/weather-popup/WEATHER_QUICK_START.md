# Quick Start: Weather API for E-ink Display

## What Was Created

Three Python scripts to fetch Estonian weather data for Toomja, Raplamaa:

1. **`weather_fetcher.py`** - Full API client with detailed 48-hour forecasts
2. **`get_current_weather.py`** - Simple script for current conditions
3. **`WEATHER_API_README.md`** - Complete documentation

## Quick Test Results

✅ Successfully fetching weather for **Toomja, Raplamaa** (59.0218292, 25.0982156)

### Current Conditions (tested 2025-10-06 20:45)
```
Temperature: 8.9°C
Conditions: Selge (Clear)
Wind: 2.0 m/s edelast
Precipitation: 0.0 mm
```

## Usage Examples

### 1. Get Current Weather (Simple One-Liner)

```bash
# Simple format
python3 get_current_weather.py --format simple
# Output: 8.9°C • Selge • Tuul 2.0 m/s

# Minimal format (perfect for small e-ink displays)
python3 get_current_weather.py --format minimal
# Output: 9° Selge

# Detailed format
python3 get_current_weather.py --format detailed
# Output:
# Location: Rapla maakond, Rapla vald, Toomja küla
# Temperature: 8.9°C
# Conditions: Selge (Clear)
# Wind: 2.0 m/s edelast
# Precipitation: 0.0 mm
# Forecast time: 2025-10-06T21:00:00

# JSON format (for scripts)
python3 get_current_weather.py --format json
# Output: {"temperature": 8.9, "weather": "Selge", ...}
```

### 2. Get 48-Hour Forecast

```bash
python3 weather_fetcher.py
```

This shows:
- Hourly forecast for next 48 hours
- Temperature, wind, precipitation, weather conditions
- 3-hour summary
- Saves full data to `toomja_weather.json`

### 3. Use in Python Code

```python
from weather_fetcher import WeatherFetcher

# Get forecast
fetcher = WeatherFetcher()
forecast = fetcher.get_forecast(coordinates="59.0218292;25.0982156")

# Extract current temperature
current = forecast['forecast']['tabular']['time'][0]
temp = current['temperature']['@attributes']['value']
weather = current['phenomen']['@attributes']['et']

print(f"Current: {temp}°C, {weather}")
```

Or use the helper:

```python
from get_current_weather import get_current_conditions, format_minimal

conditions = get_current_conditions()
display_text = format_minimal(conditions)  # "9° Selge"

# Or access individual fields
temp = conditions['temperature']  # 8.9
weather = conditions['weather']   # "Selge"
```

## Data Available

From the API you get:
- ✅ Temperature (°C)
- ✅ Wind speed (m/s) and direction (in Estonian: edelast, lõunast, etc.)
- ✅ Precipitation (mm)
- ✅ Weather phenomena (in Estonian and English)
- ✅ 48-72 hour forecast with hourly granularity

## Update Schedule

Weather model updates:
- **Summer**: 6:30, 12:30, 18:30, 00:30
- **Winter**: 5:30, 11:30, 17:30, 23:30

## For E-ink Display Integration

### Option 1: Cron Job (Recommended)

Add to crontab to update every hour:

```bash
crontab -e
```

Add line:
```
0 * * * * cd /path/to/kaiumtu && /usr/bin/python3 get_current_weather.py --format minimal > /tmp/weather.txt
```

Then your display script reads from `/tmp/weather.txt`

### Option 2: Direct Integration

```python
from get_current_weather import get_current_conditions

def update_weather_display():
    conditions = get_current_conditions("59.0218292;25.0982156")

    if conditions:
        # For e-ink display
        display_line_1 = f"{conditions['temperature']:.0f}°C"
        display_line_2 = conditions['weather']

        # Update your e-ink display here
        eink_display.show(display_line_1, display_line_2)
```

### Option 3: Use Saved JSON

```python
import json
from datetime import datetime

# Run weather_fetcher.py periodically (e.g., via cron)
# It saves to toomja_weather.json

def get_weather_from_json():
    with open('toomja_weather.json') as f:
        data = json.load(f)

    current = data['forecast']['tabular']['time'][0]
    return {
        'temp': float(current['temperature']['@attributes']['value']),
        'weather': current['phenomen']['@attributes']['et']
    }
```

## Testing Different Locations

To test another location:

```bash
# Find coordinates (example: Tallinn)
curl "https://nominatim.openstreetmap.org/search?q=Tallinn,Estonia&format=json&limit=1" | python3 -m json.tool

# Use the coordinates
python3 get_current_weather.py --coordinates "59.4370;24.7536" --format simple
```

## Files Generated

After running the scripts:
- **`toomja_weather.json`** - Full 48-hour forecast data (75KB, 3159 lines)

## No API Key Needed

✅ This is a public API from Estonian Environment Agency (Keskkonnaagentuur)
✅ No registration required
✅ No rate limits (but be respectful)

## Next Steps for Your E-ink Project

1. **Test the scripts** - They're ready to use for Toomja
2. **Choose output format** - Minimal format is perfect for small displays
3. **Set up automation** - Use cron or integrate directly
4. **Design your display** - You have temp, weather, wind, and precipitation
5. **Add icons** - The API provides weather icon names you can map to images

## Weather Phenomena Quick Reference

| Estonian | English | When to Expect |
|----------|---------|----------------|
| Selge | Clear | Night/Day, no clouds |
| Vähene pilvisus | Few clouds | Mostly clear |
| Vahelduv pilvisus | Variable clouds | Sun & clouds |
| Pilves | Cloudy | Overcast |
| Nõrk vihm | Light rain | < 2.5 mm/h |
| Mõõdukas vihm | Moderate rain | 2.5-10 mm/h |
| Nõrk lumesadu | Light snow | < 1 cm/h |
| Udu | Fog | Poor visibility |

## Example Cron Setup for E-ink Display

```bash
# /etc/cron.d/weather-display
# Update weather every hour at :05
5 * * * * pi cd /home/pi/eink-display && /usr/bin/python3 get_current_weather.py --format json > /tmp/weather.json

# Update display every 15 minutes (uses cached weather data)
*/15 * * * * pi /home/pi/eink-display/update_display.sh
```

## Support & Attribution

- **Data Source**: Keskkonnaagentuur (ilmateenistus.ee)
- **Model**: ECMWF
- **Language**: Estonian (with English translations available)

For questions about the API or data accuracy, contact: ilm@envir.ee

---

**Ready to use!** All scripts tested and working for Toomja, Raplamaa. 🎉
