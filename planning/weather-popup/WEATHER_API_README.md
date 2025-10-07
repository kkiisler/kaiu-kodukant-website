# Estonian Weather Service API Client

Python client for fetching weather forecast data from Eesti Ilmateenistus (Estonian Environment Agency) for e-ink display projects.

## Features

- ✅ **Location-based forecasts** using coordinates (lat;lon format)
- ✅ **48-hour detailed forecast** with hourly data
- ✅ **Complete weather data**:
  - Temperature (°C)
  - Wind speed (m/s) and direction
  - Precipitation (mm)
  - Weather phenomena (in Estonian)
- ✅ **3-hour summary** for quick reference
- ✅ **JSON export** for further processing

## Installation

```bash
pip install requests
```

## Usage

### Basic Usage

```python
from weather_fetcher import WeatherFetcher

fetcher = WeatherFetcher()

# Get forecast for Toomja, Raplamaa
forecast = fetcher.get_forecast(coordinates="59.0218292;25.0982156")

# Display formatted forecast
print(fetcher.format_forecast_simple(forecast, hours=24))
```

### Command Line

```bash
python3 weather_fetcher.py
```

## API Details

### Endpoint

**Meteogram API:**
```
https://www.ilmateenistus.ee/wp-content/themes/ilm2020/meteogram.php
```

**Parameters:**
- `coordinates` - Format: "latitude;longitude" (e.g., "59.0218292;25.0982156")
- `lang` - Language: `et` (Estonian), `en` (English), `ru` (Russian)
- `locationId` - Alternative to coordinates (optional)

### Update Schedule

The ECMWF model updates:
- **Summer time**: 6:30, 12:30, 18:30, 00:30
- **Winter time**: 5:30, 11:30, 17:30, 23:30

### Response Format

```json
{
  "location": "Rapla maakond, Rapla vald, Toomja küla",
  "warnings": "[]",
  "forecast": {
    "tabular": {
      "time": [
        {
          "@attributes": {
            "from": "2025-10-06T21:00:00",
            "to": "2025-10-06T22:00:00"
          },
          "phenomen": {
            "@attributes": {
              "className": "clear",
              "et": "Selge",
              "en": "Clear"
            }
          },
          "precipitation": {
            "@attributes": {
              "value": "0"
            }
          },
          "windDirection": {
            "@attributes": {
              "deg": "205.3",
              "name": "edelast",
              "icon": "wind_southwest.svg"
            }
          },
          "windSpeed": {
            "@attributes": {
              "mps": "2.3"
            }
          },
          "temperature": {
            "@attributes": {
              "unit": "celsius",
              "value": "8.9"
            }
          }
        }
        // ... more hourly forecasts
      ]
    }
  }
}
```

## Weather Phenomena (Estonian)

Common weather conditions you'll see:

| Estonian | English |
|----------|---------|
| Selge | Clear |
| Vähene pilvisus | Few clouds |
| Vahelduv pilvisus | Variable cloudiness |
| Pilves | Cloudy/Overcast |
| Nõrk vihm | Light rain |
| Mõõdukas vihm | Moderate rain |
| Tugev vihm | Heavy rain |
| Nõrk lumesadu | Light snowfall |
| Mõõdukas lumesadu | Moderate snowfall |
| Tugev lumesadu | Heavy snowfall |
| Udu | Fog |
| Äike | Thunder |

## Example Output

```
================================================================================
Weather Forecast - 2025-10-06 20:45
Location: Rapla maakond, Rapla vald, Toomja küla
================================================================================

 Time |  Temp |         Wind | Precip |              Weather
--------------------------------------------------------------------------------
21:00 | 8.9°C | 2 m/s edelast |   0 mm |                Selge
22:00 | 8.5°C | 2 m/s edelast |   0 mm |                Selge
23:00 | 8.1°C | 2 m/s edelast |   0 mm |                Selge
00:00 | 6.7°C | 1.5 m/s edelast |   0 mm |                Selge
...

================================================================================
NEXT 3 HOURS SUMMARY:
--------------------------------------------------------------------------------
Temperature: 8.1°C - 8.9°C
Total precipitation: 0.0 mm
Conditions: Selge
```

## Finding Your Coordinates

### Option 1: OpenStreetMap Nominatim

```bash
curl "https://nominatim.openstreetmap.org/search?q=YOUR_LOCATION,Estonia&format=json&limit=1"
```

### Option 2: Google Maps

1. Right-click your location on Google Maps
2. Click the coordinates to copy them
3. Format as "lat;lon" (semicolon-separated)

### Option 3: GPS Device

Use your phone's GPS coordinates in the format `lat;lon`

## Integration with E-ink Display

The `weather_fetcher.py` script can be:

1. **Scheduled with cron** to run every hour:
   ```bash
   0 * * * * /usr/bin/python3 /path/to/weather_fetcher.py
   ```

2. **Integrated into your display code**:
   ```python
   from weather_fetcher import WeatherFetcher

   def update_display():
       fetcher = WeatherFetcher()
       forecast = fetcher.get_forecast(coordinates="59.0218;25.0982")

       # Extract current conditions
       current = forecast['forecast']['tabular']['time'][0]
       temp = current['temperature']['@attributes']['value']
       weather = current['phenomen']['@attributes']['et']

       # Update your e-ink display with temp and weather
       display.show(f"{temp}°C - {weather}")
   ```

3. **Saved as JSON** for other scripts to consume:
   ```python
   import json

   # weather_fetcher.py saves to toomja_weather.json
   with open('toomja_weather.json') as f:
       weather = json.load(f)
   ```

## Data Retention

The forecast provides **48-72 hours** of hourly data. For historical data, you would need to:
- Save forecasts periodically
- Use the historical data API (separate endpoint)
- Contact Ilmateenistus for archive access

## Attribution

Data source: **Keskkonnaagentuur** (Estonian Environment Agency)
- Website: https://www.ilmateenistus.ee
- Model: ECMWF (European Centre for Medium-Range Weather Forecasts)

## Notes

- The location autocomplete API doesn't include all small villages/farms
- Using coordinates is more reliable than location IDs
- Data is provided in local Estonian time
- No API key required (public API)
- Forecast accuracy varies by weather situation
- This is model output; official forecasts are made by meteorologists

## License

This is an unofficial API client. Please respect the Estonian Environment Agency's terms of use.

## Support

For issues with the data or official forecasts, contact:
- Email: ilm@envir.ee
- Website: https://www.ilmateenistus.ee/meist/kontakt/
