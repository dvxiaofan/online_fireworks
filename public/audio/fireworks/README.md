# Fireworks audio samples

Put real fireworks recordings in this folder to replace the synthetic fallback sounds.

Supported names:

- `launch-1.wav`
- `launch-2.wav`
- `launch-3.wav`
- `boom-1.wav`
- `boom-2.wav`
- `boom-3.wav`
- `boom-heavy-1.wav`
- `boom-heavy-2.wav`
- `boom-sharp-1.wav`
- `boom-sharp-2.wav`
- `crackle-1.wav`
- `crackle-2.wav`
- `crackle-3.wav`

Use short, dry recordings when possible:

- Launch: 0.5-1.2s rocket lift-off / whistle.
- Boom: 0.8-2.0s single aerial shell explosion.
- Heavy boom: lower, slower, bass-heavy explosions.
- Sharp boom: bright, snappy reports.
- Crackle: 0.2-1.0s crackling tails or clusters.

Current bundled files are downloaded from Mixkit's free fireworks sound effects page:

https://mixkit.co/free-sound-effects/fireworks/

The app loads these files automatically at runtime and falls back to generated audio when a file is missing.
