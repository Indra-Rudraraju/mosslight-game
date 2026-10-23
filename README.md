# Mosslight

A small, playable cosmic garden game made with Python's standard library and browser-native HTML, CSS, and JavaScript. Collect 12 starlights to win, or see how much of the garden you can restore in one minute. Use your pulse to gently clear nearby shadows.

## Run locally

1. Install Python 3.10 or later.
2. From this folder, run:

   ```powershell
   python app.py
   ```

3. Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

No packages or build step are required. Scores are saved in `scores.json` beside the server file.

## Controls

- **WASD / arrow keys:** move
- **Space:** send a starlight pulse (recharges in four seconds)
- **P:** pause or resume
- **Touchscreens:** tap or drag to move; double-tap to pulse

The canvas adapts to the screen size. Sound is synthesized in the browser and can be toggled off.
