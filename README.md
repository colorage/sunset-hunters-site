# sunset-hunters-site
Site for sunset-hunters-club

## Globe rendering

The globe uses locally hosted Natural Earth 1:110m land polygons, sampled into
evenly spaced dots. `land.geojson` is from Natural Earth v5.1.2:
https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_110m_land.geojson
The map data is public domain: https://www.naturalearthdata.com/about/terms-of-use/

`globe-math.mjs` supplies geographic sampling and the Sun direction using NOAA's
fractional-year declination and equation-of-time approximation:
https://gml.noaa.gov/grad/solcalc/solareqns.PDF
The displayed terminator is the geometric solar horizon (Sun center at 0°),
while sunset times include the conventional 0.833° refraction/disk correction.
Twilight glow is an artistic treatment, not a forecast of sky conditions.

Serve this folder over HTTP (for example, `python3 -m http.server 4173`) to preview.
Run geographic and terminator checks with `node --test globe-math.test.mjs`.
