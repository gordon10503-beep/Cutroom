from functools import lru_cache
from fractions import Fraction
import argparse
import json
import math
import mimetypes
import subprocess
import tempfile
import uuid
import webbrowser
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
TEMP = tempfile.TemporaryDirectory(prefix="cutroom-")
WORK = Path(TEMP.name)
files = {"sample": ROOT / "assets/alpine-session.mp4"}


def run(args):
    result = subprocess.run(args, capture_output=True, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    if result.returncode:
        raise ValueError(result.stderr.decode(errors="replace")[-750:] or "Media processing failed.")
    return result.stdout


def probe(path):
    info = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)]))
    streams = info["streams"]
    video = next((s for s in streams if s["codec_type"] == "video" and not s.get("disposition", {}).get("attached_pic")), {})
    duration = float(info["format"].get("duration", video.get("duration", 0)) or 0)
    fps = video.get("avg_frame_rate", "0/0")
    return dict(fps=float(Fraction(fps)) if fps != "0/0" else 0, duration=duration, width=video.get("width", 0), height=video.get("height", 0),
                audio=any(s["codec_type"] == "audio" for s in streams),
                sample_rate=next((int(s["sample_rate"]) for s in streams if s["codec_type"] == "audio"), 0))


def encode(*args):
    run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)])


def cuts(duration, data):
    if data["mode"] == "fixed":
        step = float(data["length"])
        if not math.isfinite(step) or step <= 0:
            raise ValueError("Enter a positive clip length.")
        count = math.ceil(duration / step)
    elif data["mode"] == "equal":
        count = int(data["count"])
        if count <= 0:
            raise ValueError("Enter a positive clip count.")
        step = duration / count
    else:
        points = [0, *map(float, data["points"]), duration]
        if any(not math.isfinite(b) or b <= a for a, b in zip(points, points[1:])):
            raise ValueError("Cut points must increase and fall inside the video.")
        return points
    if count > 1000:
        raise ValueError("Choose fewer than 1,001 clips per export.")
    return [i * step for i in range(count)] + [duration]


def audio_filter(key, tempo):
    key, tempo = float(key), float(tempo)
    if not math.isfinite(key) or not math.isfinite(tempo) or tempo <= 0:
        raise ValueError("Enter a finite pitch and positive tempo.")
    if key == 0 and tempo == 1:
        return "anull"
    stages = max(1, math.ceil(abs(key) / 60), math.ceil(abs(math.log2(tempo)) / 5))
    pitch = 2 ** (key / stages / 12)
    speed = tempo ** (1 / stages)
    return ",".join([f"rubberband=pitch={pitch}:tempo={speed}"] * stages)


@lru_cache(maxsize=32)
def frame_times(path):
    raw = run(["ffprobe", "-v", "error", "-select_streams", "V:0", "-show_frames",
               "-show_entries", "frame=best_effort_timestamp_time:format=start_time", "-of", "json", str(path)])
    info = json.loads(raw)
    start = float(info.get("format", {}).get("start_time", 0))
    times = [float(frame["best_effort_timestamp_time"]) - start for frame in info["frames"]]
    if not times or any(b <= a for a, b in zip(times, times[1:])):
        raise ValueError("This source does not have distinct presentation timestamps for its frames.")
    return times


def export_frame_clips(path, dest, indices):
    times = frame_times(path)
    bounds = [0, *indices, len(times)]
    if any(type(i) is not int or i <= j for j, i in zip(bounds, bounds[1:])):
        raise ValueError("Cut frames must increase and fall inside the video.")
    meta = probe(path)
    for number, (first, stop) in enumerate(zip(bounds, bounds[1:]), 1):
        start = times[first] if first else 0
        end = times[stop] if stop < len(times) else meta["duration"]
        video = f"trim=start_frame={first}:end_frame={stop},setpts=PTS-{start}/TB,pad=ceil(iw/2)*2:ceil(ih/2)*2"
        audio = ["-map", "0:a:0", "-af", f"atrim=start={start}:end={end},asetpts=PTS-{start}/TB"] if meta["audio"] else []
        encode("-i", path, "-map", "0:V:0", "-vf", video, *audio, "-fps_mode", "vfr",
               "-enc_time_base", "filter", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
               "-c:a", "aac", "-movflags", "+faststart", dest / f"clip-{number:03}.mp4")


def export(data, dest):
    path = files[data["id"]]
    task = data["task"]
    if task == "story" and data["mode"] == "custom" and "frames" in data:
        export_frame_clips(path, dest, data["frames"])
    elif task == "story":
        points = cuts(probe(path)["duration"], data)
        for i, (a, b) in enumerate(zip(points, points[1:]), 1):
            encode("-ss", a, "-i", path, "-t", b-a, "-map", "0:v:0", "-map", "0:a:0?",
                   "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2,fps=30", "-c:v", "libx264", "-preset", "veryfast",
                   "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", dest / f"clip-{i:03}.mp4")
    elif task == "audioSplit" or (task == "audio" and data.get("mode", "none") != "none"):
        task = "audioSplit"
        meta = probe(path)
        if not meta["audio"]:
            raise ValueError("Choose a source with an audio track.")
        points = cuts(meta["duration"], data)
        key, tempo = float(data.get("key", 0)), float(data.get("tempo", 1))
        if key != 0 or tempo != 1:
            adjusted = dest / "adjusted-source.wav"
            encode("-i", path, "-vn", "-af", audio_filter(key, tempo), "-c:a", "pcm_s24le", adjusted)
            path = adjusted
            meta = probe(path)
            points = [t / tempo for t in points[:-1]] + [meta["duration"]]
        for i, (start, end) in enumerate(zip(points, points[1:]), 1):
            rate = meta["sample_rate"]
            first, stop = round(start * rate), round(end * rate)
            if first >= stop:
                raise ValueError("Each audio clip must contain at least one sample.")
            encode("-ss", f"{first/rate:.9f}", "-i", path, "-map", "0:a:0", "-af", f"atrim=end_sample={stop-first}",
                   "-c:a", "pcm_s24le", dest / f"clip-{i:03}.wav")
        if path.parent == dest:
            path.unlink()
    elif task == "grid":
        from PIL import Image, ImageOps
        rows, cols = int(data["rows"]), int(data["cols"])
        if not (1 <= rows <= 10 and 1 <= cols <= 10):
            raise ValueError("Choose between 1 and 10 rows and columns.")
        with Image.open(path) as src:
            height = 1440 if data["portrait"] else 1080
            source = ImageOps.exif_transpose(src).convert("RGB")
            width, total_height = 1080*cols, height*rows
            x, y, zoom = (float(data.get(k, v)) for k, v in (("x", .5), ("y", .5), ("zoom", 1)))
            if not (0 <= x <= 1 and 0 <= y <= 1 and 1 <= zoom <= 4):
                raise ValueError("Invalid crop position or zoom.")
            scale = min(source.width/width, source.height/total_height)/zoom
            w, h = width*scale, total_height*scale
            left, top = (source.width-w)*x, (source.height-h)*y
            img = source.resize((width, total_height), Image.Resampling.LANCZOS,
                                box=(left, top, min(source.width, left+w), min(source.height, top+h)))
            for r in range(rows):
                for c in range(cols):
                    tile = img.crop((c*1080, r*height, (c+1)*1080, (r+1)*height))
                    tile.save(dest / f"post-{rows*cols-r*cols-c:03}.jpg", quality=95)
    elif task in ("loop", "audio"):
        song = files[data["song"]] if task == "loop" else path
        effect = audio_filter(data["key"], data["tempo"])
        if task == "audio":
            out = dest / "audio-mix.wav"
            encode("-i", song, "-vn", "-af", effect, "-c:a", "pcm_s24le", out)
        else:
            out = dest / "cover-loop.mp4"
            soundtrack = dest / "soundtrack.wav"
            encode("-i", song, "-vn", "-af", effect, "-c:a", "pcm_s24le", soundtrack)
            duration = probe(soundtrack)["duration"]
            encode("-stream_loop", "-1", "-ignore_loop", "1", "-i", path, "-i", soundtrack,
                   "-map", "0:v:0", "-map", "1:a:0", "-t", duration,
                   "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2,fps=30", "-c:v", "libx264",
                   "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", out)
            soundtrack.unlink()
        return out
    else:
        raise ValueError("Unknown tool.")
    name, pattern = {"story": ("story-clips.zip", "*.mp4"), "audioSplit": ("audio-clips.zip", "*.wav"),
                     "grid": ("profile-grid.zip", "*.jpg")}[task]
    out = dest / name
    with zipfile.ZipFile(out, "w") as archive:
        for item in sorted(dest.glob(pattern)):
            archive.write(item, item.name)
    return out


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        route = urlparse(self.path).path
        if route.startswith("/media/"):
            path = files.get(route.split("/")[-1])
        elif route in ("/", "/index.html", "/app.js", "/style.css", "/assets/alpine.jpg"):
            path = ROOT / (route.strip("/") or "index.html")
        else:
            path = None
        if not path or not path.is_file():
            return self.send_error(404)
        size = path.stat().st_size
        start, end = 0, size-1
        partial = self.headers.get("Range", "")
        try:
            if partial:
                left, right = partial.removeprefix("bytes=").split("-")
                start = int(left) if left else max(0, size-int(right))
                end = min(int(right), end) if left and right else end
                if not 0 <= start <= end:
                    raise ValueError()
        except ValueError:
            return self.send_error(416)
        self.send_response(206 if partial else 200)
        self.send_header("Content-Type", mimetypes.guess_type(path)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(end-start+1))
        self.send_header("Accept-Ranges", "bytes")
        if partial:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        try:
            with path.open("rb") as source:
                source.seek(start)
                left = end-start+1
                while left:
                    block = source.read(min(left, 256*1024))
                    if not block:
                        break
                    self.wfile.write(block)
                    left -= len(block)
        except (ConnectionError, OSError):
            pass

    def do_POST(self):
        if self.headers.get("X-Cutroom") != "local" or self.headers.get("Host") != f"127.0.0.1:{self.server.server_port}":
            return self.send_error(403)
        try:
            n = int(self.headers["Content-Length"])
            token = uuid.uuid4().hex
            if self.path == "/upload":
                ext = self.headers.get("X-Extension", "").lower()
                path = WORK / (token + ("."+ext if ext.isalnum() and len(ext)<10 else ""))
                with path.open("wb") as f:
                    while n:
                        chunk = self.rfile.read(min(n, 1024*1024))
                        if not chunk:
                            raise ValueError("Upload interrupted.")
                        f.write(chunk)
                        n -= len(chunk)
                if self.headers.get("X-Tool") in ("audio", "audioSplit"):
                    # Normalize codec delay and container padding before calculating cut boundaries.
                    decoded = WORK / (token + "-decoded.wav")
                    encode("-i", path, "-map", "0:a:0", "-c:a", "pcm_s24le", decoded)
                    path.unlink()
                    path = decoded
                result = probe(path)
                files[token] = path
                result["id"] = token
            elif self.path == "/frames":
                path = files[json.loads(self.rfile.read(n))["id"]]
                result = {"times": frame_times(path)}
            elif self.path == "/export":
                dest = WORK / token
                dest.mkdir()
                path = export(json.loads(self.rfile.read(n)), dest)
                files[token] = path
                result = dict(url="/media/"+token, name=path.name)
            else:
                return self.send_error(404)
            status = 200
        except Exception as e:
            result, status = {"error": str(e)}, 400
        body = json.dumps(result).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=0)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    url = f"http://127.0.0.1:{server.server_port}"
    print("Cutroom is running at", url, flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    server.serve_forever()
