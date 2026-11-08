# Cutroom

Cutroom is a local Windows media editor for preparing Instagram stories, profile grids, and song covers. It runs in your browser and processes your files on your computer.

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

The launcher chooses a free local port and opens your default browser. For a specific port, run `python server.py --port 8765`. Download your exports before closing the server. Imported files and exports use a temporary workspace, and refreshing the page resets editor controls.

## Split video or audio

Choose **Story splitter** for numbered MP4 files or **Audio splitter** for numbered 24-bit PCM WAV files. Each export downloads as a ZIP.

| Mode | How to use it |
| --- | --- |
| Fixed duration | Enter a clip length in seconds. A 134-second source with a 60-second interval produces clips of 60, 60, and 14 seconds. |
| Equal parts | Enter a clip count to divide the full duration evenly. |
| Custom cuts | Scrub the player or type a position, then select **Add cut**. You can also drag directly on a clip in the sequence and release to split it, or right-click at the desired position. |

Video frame numbers start at 1. A cut at frame 34 starts the next clip at that frame. The **Cut time** readout shows its source timestamp down to milliseconds. Custom video cuts use the source frame timestamps, including for variable-frame-rate footage. Audio accepts positions in seconds to three decimal places and exports at the source sample rate.

Click a cut label to revisit it or its × to remove it. The arrows, **Ctrl+Z**, and **Ctrl+Y** undo and redo custom cut edits.

## Prepare a profile grid

Import a photo, choose rows and columns, and select portrait (3:4) or square tiles. Drag the photo behind the grid and adjust zoom to frame it. Export the JPEG tiles and post them in ascending filename order. Tile 001 goes at the bottom right.

## Make a song-cover video

Open **GIF looper**, import a GIF and a soundtrack, and set pitch and tempo. The GIF repeats until the adjusted soundtrack ends. Export an H.264 MP4 with AAC audio.

Use **Audio editor** to export the adjusted soundtrack by itself as a 24-bit WAV. Pitch is measured in semitones, so +12 raises the key by an octave. Tempo is a multiplier, so 0.8 plays at 80% speed. Use the slider or type a positive value. Audio editor playback previews the source, and the export contains the adjustments.

## Architecture and mobile plans

The UI uses HTML, CSS, and vanilla JavaScript. A Python server listens on the local loopback address, serves previews, and handles import and export requests. FFmpeg and FFprobe handle audio and video. Pillow handles image cropping and tiling. The Windows version uses the browser already installed on the machine.

Android and iOS are future targets. One possible port would reuse the editor in a mobile WebView and implement native file selection, processing, and sharing behind the same editing operations. The desktop Python server and command-line tools would need mobile equivalents. A shared Rust processing library is an option if both platforms need substantial common native code.

The included 2:14 demo uses an [alpine landscape photograph from Unsplash](https://images.unsplash.com/photo-1470770841072-f978cf4d019e).
