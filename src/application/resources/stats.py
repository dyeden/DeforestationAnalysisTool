# encoding: utf-8

import logging
import simplejson as json
import random
from resource import Resource
from flask import Response, request, jsonify, abort
from google.appengine.ext.db import Key
from google.appengine.ext import deferred

from application.models import Report, StatsStore
from application.ee_bridge import Stats
from application.commands import update_report_stats

from google.appengine.api import memcache

tables = [
    ('Municipalities', 1560866, 'name'),
    ('States', 1560836, 'name'),
    ('Federal Conservation', 1568452, 'name'),
    ('State Conservation', 1568376, 'name'),
    ('Ingienous Land',1630610, 'name'),
    ('Legal Amazon', 1205151, 'name')
]


class RegionStatsAPI(Resource):
    """ serves stats for regions

        basically is a proxy for google earth engine
    """

    def __init__(self):
        super(RegionStatsAPI, self).__init__()
        self.ee = Stats()

    def stats_for(self, report_id, assetid, table):
        return self.ee.get_stats(report_id, assetid,  table)

    # TODO: change for getattr    def list(self, report_id):
        cache_key = 'stats_' + report_id
        data = memcache.get(cache_key)
        if not data:
            try:
                data = StatsStore.all().filter('report_id =', report_id).fetch(1)[0].json
            except IndexError:
                # launch caching!
                logging.info("launching stats calc")
                deferred.defer(update_report_stats, report_id)
                abort(404)
            memcache.set(cache_key, data)
        return Response(data, mimetype='application/json')

    def get(self, report_id, id):
        r = Report.get(Key(report_id))
        s = self.stats_for(str(r.key().id()), r.assetid, int(id))
        data = json.dumps(s)
        return Response(data, mimetype='application/json')

    def polygon(self):
        """ return stats for given polygon """
        data = json.loads(request.data)
        polygon = data['polygon']
        reports = data['reports']
        try:
            reports = [Report.get(Key(x)) for x in reports]
        except ValueError:
            logging.error("can't find some report")
            abort(404)
        #TODO: test if polygon is ccw
        # exchange lat, lon -> lon, lat
        normalized_poly = [(coord[1], coord[0]) for coord in polygon]
        stats = self.ee.get_stats_for_polygon([(str(r.key().id()), r.assetid) for r in reports], [normalized_poly])
        try:
            # aggregate
            data['def'] = sum(s['def'] for s in stats)
            data['deg'] = sum(s['deg'] for s in stats)
            data['total_area'] = stats[0]['total_area']
            return Response(json.dumps(data), mimetype='application/json')
        except (KeyError, ValueError, IndexError):
            abort(404)


