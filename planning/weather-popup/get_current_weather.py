#!/usr/bin/env python3
"""
Simple script to get current weather conditions for Toomja, Raplamaa
Perfect for e-ink displays or status displays
"""

import sys
from weather_fetcher import WeatherFetcher


def get_current_conditions(coordinates="59.0218292;25.0982156"):
    """
    Get current weather conditions

    Args:
        coordinates: Location coordinates in "lat;lon" format

    Returns:
        Dictionary with current weather data or None if error
    """
    fetcher = WeatherFetcher()
    forecast = fetcher.get_forecast(coordinates=coordinates)

    if not forecast:
        return None

    # Extract the first time period (current/next hour)
    try:
        times = forecast['forecast']['tabular']['time']
        if not times or len(times) == 0:
            return None

        current = times[0]

        # Extract data
        temp = current['temperature']['@attributes']['value']
        weather = current['phenomen']['@attributes']['et']
        weather_en = current['phenomen']['@attributes'].get('en', '')
        wind_speed = current['windSpeed']['@attributes']['mps']
        wind_dir = current['windDirection']['@attributes']['name']
        precip = current['precipitation']['@attributes']['value']
        time_from = current['@attributes']['from']

        return {
            'temperature': float(temp),
            'weather': weather,
            'weather_en': weather_en,
            'wind_speed': float(wind_speed),
            'wind_direction': wind_dir,
            'precipitation': float(precip),
            'forecast_time': time_from,
            'location': forecast.get('location', 'Unknown')
        }
    except (KeyError, IndexError, TypeError) as e:
        print(f"Error parsing weather data: {e}", file=sys.stderr)
        return None


def format_simple(conditions):
    """Format conditions for simple display"""
    if not conditions:
        return "Weather data unavailable"

    temp = conditions['temperature']
    weather = conditions['weather']
    wind = conditions['wind_speed']

    return f"{temp:.1f}°C • {weather} • Tuul {wind} m/s"


def format_minimal(conditions):
    """Format for minimal displays (e.g., small e-ink)"""
    if not conditions:
        return "N/A"

    temp = conditions['temperature']
    weather = conditions['weather']

    # Shorten common weather terms
    weather_short = weather.replace('pilvisus', 'pilv').replace('Vahelduv', 'Vahel.')

    return f"{temp:.0f}° {weather_short}"


def format_detailed(conditions):
    """Format detailed conditions"""
    if not conditions:
        return "Weather data unavailable"

    return f"""
Location: {conditions['location']}
Temperature: {conditions['temperature']:.1f}°C
Conditions: {conditions['weather']} ({conditions['weather_en']})
Wind: {conditions['wind_speed']:.1f} m/s {conditions['wind_direction']}
Precipitation: {conditions['precipitation']:.1f} mm
Forecast time: {conditions['forecast_time']}
""".strip()


def main():
    """Main function"""
    import argparse

    parser = argparse.ArgumentParser(description='Get current weather for Toomja, Raplamaa')
    parser.add_argument('--coordinates', default="59.0218292;25.0982156",
                        help='Coordinates in "lat;lon" format')
    parser.add_argument('--format', choices=['simple', 'minimal', 'detailed', 'json'],
                        default='simple', help='Output format')

    args = parser.parse_args()

    conditions = get_current_conditions(args.coordinates)

    if not conditions:
        print("Failed to fetch weather data", file=sys.stderr)
        sys.exit(1)

    if args.format == 'simple':
        print(format_simple(conditions))
    elif args.format == 'minimal':
        print(format_minimal(conditions))
    elif args.format == 'detailed':
        print(format_detailed(conditions))
    elif args.format == 'json':
        import json
        print(json.dumps(conditions, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
