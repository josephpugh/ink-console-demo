import { defineTool } from "@github/copilot-sdk";
import { z } from "zod";

interface GeocodingResult {
  results?: Array<{
    latitude: number;
    longitude: number;
    name: string;
    admin1: string;
    country_code: string;
  }>;
}

interface WeatherResult {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    wind_speed_10m: number;
    weather_code: number;
  };
}

const weatherCodeDescriptions: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

async function geocodeCity(city: string): Promise<{ lat: number; lon: number; name: string; state: string } | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=en&format=json&country_code=US`;
  const res = await fetch(url);
  const data: GeocodingResult = await res.json();

  if (!data.results || data.results.length === 0) return null;

  const match = data.results.find((r) => r.country_code === "US") ?? data.results[0];
  if (!match) return null;
  return { lat: match.latitude, lon: match.longitude, name: match.name, state: match.admin1 };
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherResult> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph`;
  const res = await fetch(url);
  return res.json();
}

export const getWeatherTool = defineTool("get_weather", {
  description:
    "Get the current weather for a city in the United States. Returns temperature, humidity, wind speed, and conditions.",
  parameters: z.object({
    city: z.string().describe("The name of the US city (e.g. 'San Francisco', 'New York', 'Austin')"),
  }),
  handler: async ({ city }: { city: string }) => {
    const location = await geocodeCity(city);
    if (!location) {
      return { error: `Could not find a US city matching "${city}". Please check the spelling and try again.` };
    }

    const weather = await fetchWeather(location.lat, location.lon);
    const current = weather.current;
    const condition = weatherCodeDescriptions[current.weather_code] ?? "Unknown";

    return {
      city: location.name,
      state: location.state,
      temperature: `${current.temperature_2m}°F`,
      feelsLike: `${current.apparent_temperature}°F`,
      humidity: `${current.relative_humidity_2m}%`,
      windSpeed: `${current.wind_speed_10m} mph`,
      condition,
    };
  },
});
