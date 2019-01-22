import sys
try:
    import feedparser
except ImportError:
    sys.stdout.write("FAIL")
