import sys
import os
import logging

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))

from app import app as application
from werkzeug.debug import DebuggedApplication 
application = DebuggedApplication(application, True)

formatter = logging.Formatter(
    "[%(asctime)s] {%(pathname)s:%(lineno)d} %(levelname)s - %(message)s")
handler = RotatingFileHandler('ggv.log', maxBytes=10000000, backupCount=3)
handler.setLevel(logging.DEBUG)
handler.setFormatter(formatter)
log = logging.getLogger('werkzeug')
log.setLevel(logging.DEBUG)
log.addHandler(handler)
application.logger.addHandler(handler)