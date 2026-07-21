"""Hypertube streaming subsystem.

Clean rewrite of the search → download → transcode → stream pipeline.
Two legal video sources behind a pluggable registry (archive.org films +
academictorrents videos), a libtorrent download engine with streaming-aware
piece scheduling, on-the-fly remux/transcode to fragmented MP4, HTTP Range
serving, OpenSubtitles + embedded subtitles, per-user watched state and a
retention purge. Public entrypoint: ``streaming.api.router``.
"""
