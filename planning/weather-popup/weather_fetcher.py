#!/usr/bin/env python3
"""
Estonian Weather Service (Ilmateenistus) API Client
Fetches weather forecast data for e-ink display
"""

import requests
import json
from datetime import datetime
from typing import Dict, List, Optional


class WeatherFetcher:
    """Fetch weather data from Estonian Environment Agency"""

    BASE_URL = "https://www.ilmateenistus.ee"

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'et,en;q=0.9',
        })

    def search_location(self, query: str) -> List[Dict]:
        """
        Search for location by name

        Args:
            query: Location name (e.g., "Toomja")

        Returns:
            List of matching locations with coordinates and IDs
        """
        url = f"{self.BASE_URL}/wp-json/emhi/locationAutocomplete"
        params = {'query': query}

        try:
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            # Debug: print raw response
            print(f"   Raw response type: {type(data)}")
            print(f"   Raw response: {json.dumps(data, ensure_ascii=False, indent=2)[:500]}")

            # Handle different response formats
            if isinstance(data, dict):
                # If response is wrapped in a 'data' key
                if 'data' in data:
                    return data['data'] if isinstance(data['data'], list) else [data]
                # If it's a single location dict
                return [data]
            elif isinstance(data, list):
                return data
            else:
                return []
        except requests.exceptions.RequestException as e:
            print(f"Error searching location: {e}")
            return []

    def get_forecast(self, location_id: Optional[str] = None,
                     coordinates: Optional[str] = None,
                     lang: str = 'et') -> Optional[Dict]:
        """
        Get weather forecast for a location

        Args:
            location_id: Location ID from search
            coordinates: Format "lat;lon" (e.g., "59.024036;25.082867")
            lang: Language code (et, en, ru)

        Returns:
            Weather forecast data or None if error
        """
        url = f"{self.BASE_URL}/wp-content/themes/ilm2020/meteogram.php"

        params = {'lang': lang}
        if location_id:
            params['locationId'] = location_id
        if coordinates:
            params['coordinates'] = coordinates

        try:
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching forecast: {e}")
            print(f"Response status: {response.status_code if response else 'N/A'}")
            print(f"Response text: {response.text[:500] if response else 'N/A'}")
            return None

    def format_forecast_simple(self, forecast_data: Dict, hours: int = 24) -> str:
        """
        Format forecast data for simple text display

        Args:
            forecast_data: Raw forecast data from API
            hours: Number of hours to display (default 24)

        Returns:
            Formatted string for display
        """
        if not forecast_data:
            return "No forecast data available"

        output = []
        output.append("=" * 80)
        output.append(f"Weather Forecast - {datetime.now().strftime('%Y-%m-%d %H:%M')}")

        # Extract location
        location = forecast_data.get('location', 'Unknown location')
        output.append(f"Location: {location}")
        output.append("=" * 80)

        # Parse forecast data
        forecast = forecast_data.get('forecast', {})
        tabular = forecast.get('tabular', {})
        times = tabular.get('time', [])

        if not times:
            output.append("\nNo forecast data available")
            return "\n".join(output)

        # Header
        output.append(f"\n{'Time':>5} | {'Temp':>5} | {'Wind':>12} | {'Precip':>6} | {'Weather':>20}")
        output.append("-" * 80)

        # Display forecast for specified hours
        for i, time_data in enumerate(times[:hours]):
            if isinstance(time_data, dict):
                attrs = time_data.get('@attributes', {})
                time_from = attrs.get('from', '')

                # Parse time
                try:
                    dt = datetime.fromisoformat(time_from)
                    time_str = dt.strftime('%H:%M')
                except:
                    time_str = time_from[-8:-3] if len(time_from) > 8 else time_from

                # Temperature
                temp_data = time_data.get('temperature', {}).get('@attributes', {})
                temp = temp_data.get('value', 'N/A')
                temp_str = f"{temp}°C" if temp != 'N/A' else temp

                # Wind
                wind_speed_data = time_data.get('windSpeed', {}).get('@attributes', {})
                wind_speed = wind_speed_data.get('mps', 'N/A')

                wind_dir_data = time_data.get('windDirection', {}).get('@attributes', {})
                wind_dir = wind_dir_data.get('name', 'N/A')
                wind_deg = wind_dir_data.get('deg', '')

                wind_str = f"{wind_speed} m/s {wind_dir}"

                # Precipitation
                precip_data = time_data.get('precipitation', {}).get('@attributes', {})
                precip = precip_data.get('value', '0')
                precip_str = f"{precip} mm"

                # Weather phenomenon
                phenom_data = time_data.get('phenomen', {}).get('@attributes', {})
                weather = phenom_data.get('et', 'N/A')

                # Format row
                output.append(f"{time_str:>5} | {temp_str:>5} | {wind_str:>12} | {precip_str:>6} | {weather:>20}")

        # Summary for next 3 hours
        output.append("\n" + "=" * 80)
        output.append("NEXT 3 HOURS SUMMARY:")
        output.append("-" * 80)

        if len(times) >= 3:
            temps = []
            precips = []
            phenomena = set()

            for time_data in times[:3]:
                if isinstance(time_data, dict):
                    temp_val = time_data.get('temperature', {}).get('@attributes', {}).get('value')
                    if temp_val:
                        temps.append(float(temp_val))

                    precip_val = time_data.get('precipitation', {}).get('@attributes', {}).get('value')
                    if precip_val:
                        precips.append(float(precip_val))

                    phenom = time_data.get('phenomen', {}).get('@attributes', {}).get('et')
                    if phenom:
                        phenomena.add(phenom)

            if temps:
                output.append(f"Temperature: {min(temps):.1f}°C - {max(temps):.1f}°C")
            if precips:
                total_precip = sum(precips)
                output.append(f"Total precipitation: {total_precip:.1f} mm")
            if phenomena:
                output.append(f"Conditions: {', '.join(phenomena)}")

        return "\n".join(output)


def main():
    """Test the weather fetcher"""
    print("Estonian Weather Fetcher - Testing")
    print("=" * 60)

    fetcher = WeatherFetcher()

    # Toomja coordinates from OpenStreetMap
    toomja_coords = "59.0218292;25.0982156"
    location_name = "Toomja, Raplamaa"

    print(f"\n1. Fetching forecast for: {location_name}")
    print(f"   Coordinates: {toomja_coords}")

    forecast = fetcher.get_forecast(coordinates=toomja_coords)

    if forecast:
        print("\n2. Forecast data received successfully!\n")
        print(fetcher.format_forecast_simple(forecast, hours=48))

        # Save to JSON file for reference
        output_file = "toomja_weather.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(forecast, f, ensure_ascii=False, indent=2)
        print(f"\n\nFull forecast data saved to: {output_file}")
    else:
        print("\n2. Failed to fetch forecast data")


if __name__ == "__main__":
    main()
