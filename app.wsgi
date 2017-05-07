import sys
import os
import logging

logging.basicConfig(stream=sys.stderr)

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))

from app import app as application
from werkzeug.debug import DebuggedApplication 
application = DebuggedApplication(application, True)
