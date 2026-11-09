# Cutroom

Cutroom is a local media editor for preparing Instagram stories, profile grids, and song covers. Windows runs the editor in your browser. The Android and iOS projects package it in a WebView with an offline media engine.

## Run on Windows

1. Install Python 3 and make the `python` command available in PowerShell.
2. Install Pillow with `python -m pip install Pillow`.
3. Install FFmpeg and FFprobe and put both executables on your PATH. Choose an FFmpeg build that includes the `libx264` encoder and the `rubberband` audio filter.
4. Double-click **Open Cutroom.cmd**, or run `python server.py` from the project directory. Keep the terminal open while editing.

To check your media tools, run these commands in PowerShell.

```powershell
ffprobe -version
ffmpeg -hide_banner -encoders | Select-String libx264
ffmpeg -hide_banner -filters | Select-String rubberband
```

The launcher chooses a free local port and opens your default browser. For a specific port, run `python server.py --port 8765`. Windows exports are saved in `Downloads/Cutroom` under your user profile. Select **Open export folder** when rendering finishes to open the export in Explorer. Imports use a temporary workspace, and refreshing the page resets editor controls.

## Split video or audio

Choose **Story splitter** for numbered MP4 files or open **Audio editor** for 24-bit PCM WAV files. Audio starts in **No cut** and exports one WAV. Select a split mode to export a ZIP of numbered clips with your pitch and tempo settings. Place cuts on the source timeline. For example, the first 60 seconds of the source becomes about 30 seconds at 2× tempo.

| Mode | How to use it |
| --- | --- |
| Fixed duration | Enter a clip length in seconds. A 134-second source with a 60-second interval produces clips of 60, 60, and 14 seconds. |
| Equal parts | Enter a clip count to divide the full duration evenly. |
| Custom cuts | Scrub the player or type a position, then select **Add cut**. You can also drag directly on a clip in the sequence and release to split it, or right-click at the desired position. |

Video frame numbers start at 1. A cut at frame 34 starts the next clip at that frame. The **Cut time** readout shows its source timestamp down to milliseconds. After frame indexing, the frame-rate readout shows FPS and labels variable-rate footage with its average. Custom video cuts use the source frame timestamps, including for variable-frame-rate footage. Audio accepts positions in seconds to three decimal places and exports at the source sample rate.

Click a cut label to revisit it or its × to remove it. The arrows, **Ctrl+Z**, and **Ctrl+Y** undo and redo custom cut edits.

## Prepare a profile grid

Import a photo, choose rows and columns, and select portrait (3:4) or square tiles. Drag the photo behind the grid and adjust zoom to frame it. Export the JPEG tiles and post them in ascending filename order. Tile 001 goes at the bottom right.

## Make a song-cover video

Open **GIF looper**, import a GIF and a soundtrack, and set pitch and tempo. The GIF repeats until the adjusted soundtrack ends. Export an H.264 MP4 with AAC audio.

Use **Audio editor** to export the adjusted soundtrack by itself as a 24-bit WAV. Pitch is measured in semitones, so +12 raises the key by an octave. Tempo is a multiplier, so 0.8 plays at 80% speed. Use the slider or type a positive value. Press Play to audition the soundtrack. Pitch and tempo update during playback. The − and + buttons step by one semitone. Live pitch preview uses a low-latency effect, so its sound can differ from the final render.

## Packaged apps

**Windows x64.** Extract the entire portable ZIP, then open `Cutroom.exe`. Keep the small Cutroom window open while editing. The distribution includes Python, Pillow, FFmpeg and FFprobe. To rebuild on Windows with those tools installed, install PyInstaller with `python -m pip install pyinstaller` and run `.\scripts\build-windows.ps1` from PowerShell. The app folder is written to `dist/Cutroom`.

**Android.** Install the debug APK on your phone for personal testing. The app works independently of the PC. The progress bar shows rendering and saving. Finished exports are saved on the device. Use **Open export folder** or **Saved exports** to browse them, and **Share file** to send one to another app. To rebuild, install Node.js 22+, JDK 21, and Android SDK Platform 35. Run the following commands from the repository root, then find the APK at `android/app/build/outputs/apk/debug/app-debug.apk`.

```powershell
npm ci
npm run build:mobile
npx cap sync android
.\android\gradlew.bat -p android assembleDebug
```

**iOS.** On a Mac with Xcode and CocoaPods installed, run `npm ci`, `npm run build:mobile`, `npx cap sync ios`, and `npx cap open ios`. Select your development team and iPhone in Xcode, then run the App target. The repository includes the iOS project. Building and signing an iPhone installation requires the Mac toolchain.

## Processing and performance

Windows uses native FFmpeg, FFprobe and Pillow. Mono and stereo 24-bit PCM audio splits copy samples in chunks. Grid exports resize each tile directly from the source crop to keep peak memory use down.

The mobile apps bundle FFmpeg WebAssembly locally. The editor starts a worker when it needs to inspect or process media, mounts source files for reading, and releases the worker after the job. Photo grids use one tile-sized canvas. Exports use the device share sheet. Long video encodes can take time and use substantial memory on phones. Keep Cutroom in the foreground until the export completes.

Mobile pitch and tempo changes use sample-rate conversion and FFmpeg tempo filters. Windows uses Rubber Band. Preview support for imported media depends on the codecs supported by the device WebView.

The included 2:14 demo uses an [alpine landscape photograph from Unsplash](https://images.unsplash.com/photo-1470770841072-f978cf4d019e).
