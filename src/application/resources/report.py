# encoding: utf-8

"""
class NDFIMapApi(Resource):
     resource to get ndfi map access data

    @staticmethod
    def _cache_key(report_id):
        return report_id + "_ndfi"

    def list(self, report_id):
        cache_key = self._cache_key(report_id)
        data = memcache.get(cache_key)
        if not data:
            r = Report.get(Key(report_id))
            ndfi = NDFI(r.comparation_range(), r.range())
            logging.info('((((( Ponto de partida para a classificacao )))))')
            data = ndfi.mapid2(r.base_map())
            if not data:
                abort(404)
            memcache.add(key=cache_key, value=data, time=3600)
        return jsonify(data)
"""

from datetime import date
import datetime
import logging
import logging

from google.appengine.api import memcache
from google.appengine.api import users
from google.appengine.ext.db import Key

from application import settings
from application.constants import amazon_bounds
from application.ee_bridge import NDFI, EELandsat
from application.models import Report, Cell, Area, Note, CELL_BLACK_LIST, User
from application.time_utils import date_from_julian
from application.time_utils import timestamp
from flask import Response, request, jsonify, abort
from resource import Resource
import simplejson as json


class NDFIMapApi(Resource):
    """ resource to get ndfi map access data """

    @staticmethod
    def _cache_key(report_id, sensor):
        return report_id + "_ndfi_" + sensor

    def list(self, report_id, sensor):
        cache_key = self._cache_key(report_id, sensor)
        data = memcache.get(cache_key)
        if not data:
            r = Report.get(Key(report_id))
            ndfi = NDFI(r.comparation_range(), r.range())
            logging.info('((((( Report Id: ' + str(report_id) +', Sensor:'+ str(sensor) +' )))))')
            data = ndfi.mapid2(r.base_map(), sensor)
            if not data:
                abort(404)
            memcache.add(key=cache_key, value=data, time=3600)
        return jsonify(data)



class UserAPI(Resource):

    def list(self):
        return self._as_json([x.as_dict() for x in User.all()])

    def get(self, id):
        u = User.get(Key(id))
        return Response(u.as_json(), mimetype='application/json')

    def update(self, id):
        data = json.loads(request.data)
        u = User.get(Key(id))
        if 'current_cells' in data:
            u.current_cells = data['current_cells']
        if 'is_admin' in data:
            if data['is_admin']:
                u.role = "admin"
            else:
                u.role = "editor"
        u.put()
        return Response(u.as_json(), mimetype='application/json')

    def create(self):
        data = json.loads(request.data)
        if 'mail' not in data:
            abort(400)
        u = users.User(data['mail'])
        a = User(role='editor',
                 user=u)
        a.save();
        return Response(a.as_json(), mimetype='application/json')

class ReportAPI(Resource):

    def list(self):
        return self._as_json([x.as_dict() for x in Report.all()])

    def get(self, id):
        r = Report.get(Key(id))
        return Response(r.as_json(), mimetype='application/json')

    def close(self, report_id):
        """ close current and create new one """
        r = Report.get(Key(report_id))
        if not r.finished:
            ndfi = NDFI(r.comparation_range(), r.range())
            data = ndfi.freeze_map(r.base_map(), int(settings.FT_TABLE_ID), r.key().id())
            logging.info(data)
            if 'data' not in data:
                abort(400)
            data = data['data']['id']
            r.close(data)
            cache_key = NDFIMapApi._cache_key(report_id)
            memcache.delete(cache_key)
            # open new report
            new_report = Report(start=date.today())
            new_report.put()
            return str(new_report.key())
        return "already finished"

class CellAPI(Resource):
    """ api to access cell info """

    def is_in_backlist(self, cell):
        return False
        return cell.external_id() in CELL_BLACK_LIST


    def list(self, report_id, operation):
        r = Report.get(Key(report_id))
        cell = Cell.get_or_default(r, 0, 0, 0)
        return self._as_json([x.as_dict() for x in iter(cell.children()) if not self.is_in_backlist(x)])

    def children(self, report_id, operation, id):
        r = Report.get(Key(report_id))
        z, x, y = Cell.cell_id(id)
        cell = Cell.get_or_default(r, operation, x, y, z)
        cells = cell.children()
        return self._as_json([x.as_dict() for x in cells if not self.is_in_backlist(x)])

    def get(self, report_id, operation, id):
        r = Report.get(Key(report_id))
        z, x, y = Cell.cell_id(id)
        cell = Cell.get_or_default(r,  operation, x, y, z)
        return Response(cell.as_json(), mimetype='application/json')

    def update(self, report_id, operation, id):
        r = Report.get(Key(report_id))
        z, x, y = Cell.cell_id(id)
        cell = Cell.get_or_default(r, operation, x, y, z)
        cell.report = r

        data = json.loads(request.data)
        cell.ndfi_low = float(data['ndfi_low'])
        cell.ndfi_high = float(data['ndfi_high'])
        cell.compare_view = str(data['compare_view'])
        cell.map_one_layer_status = str(data['map_one_layer_status'])
        cell.map_two_layer_status = str(data['map_two_layer_status'])
        cell.map_three_layer_status = str(data['map_three_layer_status'])
        cell.map_four_layer_status = str(data['map_four_layer_status'])
        cell.done = data['done']
        cell.last_change_by = users.get_current_user()
        cell.put()

        return Response(cell.as_json(), mimetype='application/json')

    def ndfi_change(self, report_id, id):
        r = Report.get(Key(report_id))
        z, x, y = Cell.cell_id(id)
        cell = Cell.get_or_default(r, x, y, z)
        ee = ndfi = NDFI(r.comparation_range(), r.range())

        bounds = cell.bounds(amazon_bounds)
        ne = bounds[0]
        sw = bounds[1]
        # spcify lon, lat
        polygons = [ (sw[1], sw[0]), (sw[1], ne[0]), (ne[1], ne[0]), (ne[1], sw[0]) ]
        cols = 1
        rows = 1
        if z < 2:
            cols = rows = 5
        data = ndfi.ndfi_change_value(r.base_map(), {"type":"Polygon","coordinates":[polygons]}, rows, cols)
        logging.info(data)
        ndfi = data #data['properties']['ndfiSum']['values']
        return Response(json.dumps(ndfi), mimetype='application/json')

    def bounds(self, report_id, id):
        r = Report.get(Key(report_id))
        z, x, y = Cell.cell_id(id)
        cell = Cell.get_or_default(r, x, y, z)
        return Response(json.dumps(cell.bounds(amazon_bounds)), mimetype='application/json')

    def landsat(self, operation, report_id, id):
        r = Report.get(Key(report_id))
        z, x, y = Cell.cell_id(id)
        cell = Cell.get_or_default(r, operation, x, y, z)
        bounds = cell.bounds(amazon_bounds)
        bounds = "%f,%f,%f,%f" % (bounds[1][1], bounds[1][0], bounds[0][1], bounds[0][0])
        ee = EELandsat(timestamp(r.start), datetime.datetime.now())
        d = ee.list(bounds=bounds)
        data = {}
        if len(d) >= 1:
            x = d[-1]
            img_info = x.split('/')[2][3:]
            path = img_info[:3]
            row = img_info[3:6]
            year = int(img_info[6: 10])
            julian_date =  img_info[10: 13]
            date = date_from_julian(int(julian_date), year)
            data = {
                'info': img_info,
                'path': path,
                'row': row,
                'year': year,
                'timestamp': timestamp(date),
                'date': date.isoformat()
            }
        return Response(json.dumps(data), mimetype='application/json')

    def rgb_mapid(self, report_id, operation, id, r, g, b, sensor):
        report = Report.get(Key(report_id))
        z, x, y = Cell.cell_id(id)
        cell = Cell.get_or_default(report, operation, x, y, z)
        ndfi = NDFI(report.comparation_range(), report.range())
        poly = cell.bbox_polygon(amazon_bounds)
        mapid = ndfi.rgb_stretch(poly, sensor, tuple(map(int, (r, g, b))))
        if not mapid:
            abort(404)
        return Response(json.dumps(mapid), mimetype='application/json')

class PolygonAPI(Resource):

    def list(self, report_id, operation, cell_pos):
        r = Report.get(Key(report_id))
        z, x, y = Cell.cell_id(cell_pos)
        cell = Cell.get_cell(r, operation, x, y, z)
        if not cell:
            return self._as_json([])
        else:
            return self._as_json([x.as_dict() for x in cell.area_set])

    def get(self, report_id, cell_pos, id):
        a = Area.get(Key(id))
        if not a:
            abort(404)
        return Response(a.as_json(), mimetype='application/json')


    def create(self, operation, report_id, cell_pos):
        r = Report.get(Key(report_id))
        z, x, y = Cell.cell_id(cell_pos)
        cell = Cell.get_or_create(r, operation, x, y, z)
        data = json.loads(request.data)
        a = Area(geo=json.dumps(data['paths']),
            type=data['type'],
            added_by = users.get_current_user(),
            cell=cell)
        a.save();
        cell.last_change_by = users.get_current_user()
        cell.put()
        return Response(a.as_json(), mimetype='application/json')

    def update(self, report_id, cell_pos, id):
        data = json.loads(request.data)
        a = Area.get(Key(id))

        a.geo = json.dumps(data['paths'])
        a.type = data['type']

        a.added_by = users.get_current_user()
        a.save();
        return Response(a.as_json(), mimetype='application/json')

    def delete(self, operation, report_id, cell_pos, id):
        a = Area.get(Key(id))
        if a:
            a.delete();
            a = Response("deleted", mimetype='text/plain')
            a.status_code = 204;
            return a
        abort(404)

class NoteAPI(Resource):

    def list(self, report_id, cell_pos):
        r = Report.get(Key(report_id))
        z, x, y = Cell.cell_id(cell_pos)
        cell = Cell.get_cell(r, x, y, z)
        notes = []
        if cell:
            return self._as_json([x.as_dict() for x in cell.note_set])
        return self._as_json([])


    def create(self, report_id, cell_pos):
        r = Report.get(Key(report_id))
        z, x, y = Cell.cell_id(cell_pos)
        cell = Cell.get_or_create(r, x, y, z)
        data = json.loads(request.data)
        if 'msg' not in data:
            abort(400)
        a = Note(msg=data['msg'],
                 added_by = users.get_current_user(),
                 cell=cell)
        a.save();
        return Response(a.as_json(), mimetype='application/json')

