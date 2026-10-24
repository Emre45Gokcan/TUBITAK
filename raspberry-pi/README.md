# Raspberry Pi AI companion client

A lightweight hardware client for the web app. The Raspberry Pi records your voice, sends it to the backend over HTTPS, plays the spoken reply and shows a face (happy / neutral / angry). All AI work happens in the web app: speech-to-text, the Claude conversation, emotion choice and text-to-speech. The Pi never holds an AI provider key.

```
 USB mic ─┐                                   ┌─ POST /api/robot/talk (WAV)
          ├─ main.py ── Wi-Fi / HTTPS ───────►│     STT → Claude → emotion → TTS
 speaker ─┤   (push-to-talk)                  │◄─ { text, emotion, audioUrl }
  LCD ────┘                                   ├─ GET  /api/robot/audio/<id>  (WAV, 10 min)
                                              └─ POST /api/robot/heartbeat  (every 30 s)
```

The Pi starts every connection itself, so it needs no port forwarding, inbound connections or static IP.

| File | What it does |
|---|---|
| `main.py` | Entry point and command-line options; wires everything together |
| `companion.py` | Interaction loop: push-to-talk → record → backend → speak + face. Has no hardware imports |
| `api_client.py` | HTTPS client for the robot API: typed errors, response validation |
| `audio.py` | Microphone (sounddevice); speaker via the system player (`afplay` on macOS, `aplay` on Linux) with sounddevice as fallback; WAV helpers; a WAV-file "microphone" for testing |
| `display.py` / `faces.py` | Face rendering (pygame) on its own loop, optional on-screen talk button; a console fallback |
| `controls.py` | Push-to-talk: Enter key, on-screen button / Space, GPIO button, or one-shot |
| `config.py` | Settings from environment variables / `.env` |
| `robot-companion.service` | systemd unit for starting at boot |
| `tests/` | Unit tests with fake hardware and a fake backend |

## 1. Test on a computer first (no Raspberry Pi needed)

You need Python 3.9+, and the web app running locally (`npm run dev`). In the web app's `.env.local`, set `ROBOT_AI_MOCK=1` to use fake AI (no keys, no cost), or set real `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` values.

```bash
cd raspberry-pi
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m unittest                   # client tests (no hardware, no network)
```

1. In the web app, sign in as admin and go to **Robotlar → Yeni robot**. Copy the `.env` lines it shows into `raspberry-pi/.env` (start from `.env.example`). Locally, `ROBOT_API_URL=http://localhost:3000` is allowed; any other host must use `https://`.
2. Make a test recording. Any 16-bit PCM WAV file works. On macOS:
   ```bash
   say -v Yelda "Merhaba robot, bugün nasılsın?" -o test.aiff
   afconvert -f WAVE -d LEI16@16000 -c 1 test.aiff test.wav
   ```
   On Linux: `arecord -f S16_LE -r 16000 -d 5 test.wav`, or `espeak-ng -v tr -w test.wav "Merhaba"`.
3. Run the client without hardware:
   ```bash
   python main.py --check --wav test.wav --no-audio      # config + backend connection
   python main.py --wav test.wav --once --no-audio --display console
   python main.py --wav test.wav                          # face window + speakers; Enter sends the file
   ```
   - `--no-audio` saves the reply to `last-reply.wav` instead of playing it.
   - `--display console` prints the face state instead of opening a window.
   - Without `--wav`, the computer's microphone is used: press Enter to start, Enter again to stop.
4. **Desktop simulator** (talk to the robot with your computer's microphone and speakers):
   ```bash
   python main.py --desktop
   ```
   A window shows the face with a state label (Hazır / Dinliyorum / Düşünüyorum / Konuşuyorum), a microphone level meter and a **Konuş** button. Click the button or press **Space** to start, and again to stop. You can also hold Space and release it to send. Esc closes the window. The face shows the reply's expression while it speaks, then goes back to neutral. On macOS, allow microphone access for your terminal app the first time (System Settings → Privacy & Security → Microphone). A silent recording, for example with no permission, is never sent to the server.
5. Check that conversation history works. Run the `--once` command twice: with memory on, the second reply has the first turn as context (in mock mode it says "2. mesajını aldım"). The full conversation appears on the robot's page in the dashboard, and the robot shows as **Bağlı** while the client runs.

## 2. Hardware

| Part | Notes |
|---|---|
| Raspberry Pi 5 + official 27 W USB-C power supply | Any Pi with Wi-Fi works; a Pi 5 is recommended |
| microSD card (16 GB+) | |
| USB microphone | Any USB Audio Class microphone |
| USB speaker | Or a USB sound card + speaker |
| Small display | HDMI or DSI is easiest (works out of the box). For SPI LCDs, see step 5 |
| Push button (optional) | Between **GPIO17 (pin 11)** and **GND (pin 9)**. No resistor needed; the internal pull-up is used |

## 3. Install Raspberry Pi OS and Wi-Fi

1. Install [Raspberry Pi Imager](https://www.raspberrypi.com/software/) on your computer and choose **Raspberry Pi OS Lite (64-bit)**. Lite is recommended for a dedicated robot; Desktop also works.
2. In Imager, open **Edit settings** (OS customisation) and set:
   - hostname (e.g. `robot`)
   - user name `pi` and a password
   - your Wi-Fi network name and password
   - Wi-Fi country `TR`
   - **Enable SSH** (Services tab)
3. Write the card, insert it, power on, and connect with `ssh pi@robot.local`.
4. To change Wi-Fi later, use `sudo nmtui`, or:
   ```bash
   sudo nmcli dev wifi connect "AğAdı" password "şifre"
   ```
   The client keeps retrying while Wi-Fi is down, showing "Sunucuya bağlanılamadı", and recovers on its own when the network returns.

## 4. Install the client

```bash
sudo apt update
sudo apt install -y git python3-venv python3-dev libportaudio2 alsa-utils \
  libsdl2-2.0-0 libsdl2-ttf-2.0-0 fonts-dejavu-core python3-gpiozero python3-lgpio

mkdir -p ~/robot && cd ~/robot
git clone <your-repo-url> .           # or copy just the raspberry-pi/ folder with scp
cd raspberry-pi
python3 -m venv --system-site-packages .venv   # makes the system gpiozero/lgpio visible
.venv/bin/pip install -r requirements.txt
```

## 5. Connect and test audio and the display

**Audio:**

```bash
arecord -l && aplay -l                                  # USB devices should be listed
arecord -D plughw:CARD=Device -f S16_LE -r 16000 -d 5 /tmp/t.wav && aplay /tmp/t.wav
alsamixer                                               # F6 picks the card; raise mic/speaker levels
.venv/bin/python -m sounddevice                         # device names the client can use
```

Card names vary (`Device`, `Microphone`, `UACDemoV10`…). If the defaults aren't your USB devices, set part of a device name in `.env`, e.g. `ROBOT_INPUT_DEVICE=USB` and `ROBOT_OUTPUT_DEVICE=USB`. Replies are played with `aplay` (on that card, as `plughw:X,Y`), so no Python code runs in the real-time audio path. On macOS they're played with `afplay` on the system output; setting `ROBOT_OUTPUT_DEVICE` there switches to sounddevice.

**Display:**

- **HDMI / DSI:** no setup needed. The client draws fullscreen with `ROBOT_DISPLAY=fullscreen`. On Raspberry Pi OS Lite it uses SDL's `kmsdrm` driver, which the systemd unit sets.
- **SPI LCD** (e.g. 3.5″ 480×320 HATs): install the driver from your screen's vendor. It usually adds a `dtoverlay=...` line to `/boot/firmware/config.txt` and exposes the panel as a display or framebuffer. Then set `ROBOT_SCREEN_WIDTH`/`ROBOT_SCREEN_HEIGHT` to the panel resolution. The faces scale to any size.
- **No screen:** `ROBOT_DISPLAY=console` logs the expression instead.

Preview the faces as PNG files with `.venv/bin/python faces.py /tmp/faces`. To use your own artwork, see `faces/README.md`.

## 6. Configure and register the robot

1. In the web app (as admin): **Robotlar → Yeni robot**, give it a name, and copy the shown `.env` lines. The token is shown only once; if you lose it, use **Yeni anahtar oluştur** on the robot's page.
2. On the Pi:
   ```bash
   cp .env.example .env && nano .env      # paste ROBOT_API_URL / ROBOT_DEVICE_ID / ROBOT_DEVICE_TOKEN
   chmod 600 .env
   ```
   Recommended values on the robot: `ROBOT_TRIGGER=gpio` and `ROBOT_DISPLAY=fullscreen`.
3. On the robot's dashboard page, set the model, personality, voice, memory and enabled expressions. Changes apply from the robot's next turn.

On a touchscreen, `ROBOT_TRIGGER=screen` shows the same talk button (tap = click).

## 7. Run

```bash
.venv/bin/python main.py --check     # ✓ mikrofon, ✓ hoparlör, ✓ sunucu
.venv/bin/python main.py             # hold the button (or press Enter over SSH) and speak
```

Within about 30 seconds the dashboard shows the robot as **Bağlı**. The status dot in the screen's top-right corner means: green = connected, grey = offline, red = token rejected.

## 8. Start automatically at boot (systemd)

```bash
nano robot-companion.service          # check User= and the paths (default: /home/pi/robot/raspberry-pi)
sudo cp robot-companion.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now robot-companion
journalctl -u robot-companion -f      # logs
```

`Restart=always` brings the client back after crashes or power glitches. With the Desktop image, run the client from the desktop session instead (autostart); otherwise the desktop holds the display. Remove the `SDL_VIDEODRIVER` line in that case.

## Behaviour and error handling

| Situation | What the robot does |
|---|---|
| Wi-Fi down / server unreachable | Shows "Sunucuya bağlanılamadı"; the heartbeat retries with back-off; recovers by itself |
| Request takes too long (75 s) | Shows "Sunucu zamanında yanıt vermedi", returns to listening |
| Wrong token or robot deactivated | Shows the reason, red status dot; heartbeat retries every 5 minutes. Fix `.env` or reactivate the robot in the dashboard |
| Microphone missing | Shows "Mikrofon bulunamadı" on each press; works again once it is plugged in |
| Speaker missing / playback fails | Still shows the expression; logs the reply text; shows "Hoparlör bulunamadı" |
| Invalid or unexpected server response | Shows an error; any unknown emotion is displayed as neutral |
| Too short a recording | Asks you to hold the button while speaking; nothing is sent |

Limits: recordings up to `ROBOT_MAX_RECORDING_SECONDS` (default 30, max 60) and 4 MB, which matches Vercel's request size limit. Reply audio expires on the server after 10 minutes. The backend rate-limits each robot to 30 turns per 10 minutes.

## Security

- The device token is the robot's password. Keep `.env` private (`chmod 600`). If it leaks, use **Yeni anahtar oluştur**; the old token stops working immediately.
- The server stores only a SHA-256 hash of the token. It never sends AI provider keys to the Pi.
- The client refuses plain `http://` except for `localhost`. `ROBOT_ALLOW_INSECURE=1` exists only for LAN testing.
