# ScholarMCP Video Worker

Cloud-only worker for ScholarMCP study-video rendering.

Initial benchmark target:

1. Arabic narration generated on the remote worker.
2. Timed scene data rendered with Remotion.
3. FFmpeg produces MP4 on the remote worker.
4. No AI/TTS/FFmpeg model is downloaded to the student device.

This worker is intentionally isolated from the web frontend. It is deployed to Modal through CI; student requests are executed on Modal, not on GitHub Actions.
