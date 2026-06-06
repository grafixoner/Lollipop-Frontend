# Mixtape Display App

The `mixtape/` directory is the public display surface for Lollipop mixtapes. It renders three skins with shared YouTube playback logic:

- `default`
- `cassette`
- `popamp`

## Structure

```txt
index.html
assets/
css/base.css
css/cassette.css
css/popamp.css
data/mixtape-data.js
js/app.js
skins/
```

## Runtime behavior

- `/mixtape/<slug>` loads the app shell and fetches `/configs/<slug>.json`
- the player reads mixtape data from `section_mixtape`
- if `section_mixtape` is missing, the app renders a custom missing-mixtape page

## `section_mixtape` field order

The display app currently expects this field layout:

```json
{
  "id": "section_mixtape",
  "fields": [
    { "value": "My Mixtape" },
    { "value": [] },
    { "group": true, "value": "#3a3a3a" },
    { "group": true, "value": "#cccccc" },
    { "value": true },
    { "value": "cassette" },
    { "value": false }
  ]
}
```

Meaning:

- `fields[0]`: title
- `fields[1]`: tracks
- `fields[2]`: default-player background color
- `fields[3]`: default-player text color
- `fields[4]`: reserved boolean
- `fields[5]`: skin
- `fields[6]`: mystery mode

## Track shape

```json
{
  "youtubeVideoId": "7xzU9Qqdqww",
  "title": "Kid Cudi - Pursuit Of Happiness (Official Music Video) ft. MGMT",
  "artist": "KidCudi",
  "durationSeconds": 284,
  "externalUrl": "https://www.youtube.com/watch?v=7xzU9Qqdqww"
}
```

## Notes

- `data/mixtape-data.js` still provides a local demo manifest and optional `window.MIXTAPE_ENDPOINT`
- Font Awesome is expected to be available from the main site path
- cassette markup is adapted from the original CodePen structure and now lives in the `skins/` partials plus `css/cassette.css`
