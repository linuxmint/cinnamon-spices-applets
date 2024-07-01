import sys
try:
    import feedparser
    sys.stdout.write(feedparser.USER_AGENT)
except ImportError:
    sys.stdout.write("FAIL")
