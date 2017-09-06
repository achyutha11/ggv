import sys
from os.path import dirname, realpath
import logging

base_path = dirname(realpath(__file__))

sys.path.insert(0, dirname(base_path))

from ggv.app import app as application
from werkzeug.debug import DebuggedApplication 
application = DebuggedApplication(application, True)