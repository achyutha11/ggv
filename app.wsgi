import sys
from os.path import dirname, realpath
import logging

base_path = dirname(realpath(__file__))

sys.path.insert(0, dirname(base_path))

from ggv.app import app as application
from werkzeug.debug import DebuggedApplication 
application = DebuggedApplication(application, True)

formatter = logging.Formatter(
    "[%(asctime)s] {%(pathname)s:%(lineno)d} %(levelname)s - %(message)s")
handler = logging.handlers.RotatingFileHandler(base_path + '/ggv.log', maxBytes=10000000, backupCount=3)
handler.setLevel(logging.DEBUG)
handler.setFormatter(formatter)
log = logging.getLogger('werkzeug')
log.setLevel(logging.DEBUG)
log.addHandler(handler)
application.logger.addHandler(handler)