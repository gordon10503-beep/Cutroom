import os
import sys
import threading
import tkinter as tk
import webbrowser
from pathlib import Path
from http.server import ThreadingHTTPServer
from tkinter import ttk
import server

def main():
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w")
    bundled = Path(server.__file__).resolve().parent / "bin"
    os.environ["PATH"] = str(bundled) + os.pathsep + os.environ["PATH"]
    http = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
    threading.Thread(target=http.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{http.server_port}"
    window = tk.Tk()
    window.title("Cutroom")
    panel = ttk.Frame(window, padding=20)
    panel.pack()
    ttk.Label(panel, text="Cutroom is running on this PC.").pack()
    ttk.Button(panel, text="Open editor", command=lambda: webbrowser.open(url)).pack(pady=12)
    ttk.Label(panel, text="Close this window to stop Cutroom.").pack()
    window.after(100, lambda: webbrowser.open(url))
    window.mainloop()
    http.shutdown()
    http.server_close()

if __name__ == "__main__":
    main()
