
var PolygonView = Backbone.View.extend({

    DEGRADATION_COLOR:"rgb(255, 199, 44)", //"#fff700", //"#FFCC33",
    DEFORESTATION_COLOR:  "rgb(255, 46, 0)", //"#ff0055", //"#FF3300",

    initialize: function() {
        _.bindAll(this, 'click', 'remove', 'update', 'render');
        this.mapview = this.options.mapview;
        this.model.bind('destroy', this.remove);
        this.model.bind('change', this.update);
    },

    render: function() {
        var self = this;
        var fillColor = this.DEFORESTATION_COLOR;
        if(this.model.get('type') == this.model.DEGRADATION) {
            fillColor = this.DEGRADATION_COLOR;
        }
        // conversion
        var poly = new google.maps.Polygon({
                paths: this.model.paths(),
                fillOpacity: 1.0,
                fillColor: fillColor,
                strokeColor: "#fff",
                strokeWeight: 1.5
        });
        poly.setMap(this.mapview.map);
        google.maps.event.addListener(poly, 'click', this.click);
        google.maps.event.addListener(poly, 'mouseover', function(e) {
            self.trigger('mouseover', this, e);
        });
        google.maps.event.addListener(poly, 'mouseout', function(e) {
            self.trigger('mouseout', this, e);
        });
        this.poly = poly;
    },

    update: function() {
        this.poly.setPaths(this.model.paths());
    },

    click: function(event) {
        this.trigger('click', this);
    },

    remove: function() {
        this.poly.setMap(null);
        // javascript FTW
        this.view.poly_views.splice(this.view.poly_views.indexOf(this), 1);
    }

}); 

var CellPolygons = Backbone.View.extend({

    initialize: function() {
        _.bindAll(this, 'remove', 'add', 'addAll', 'commit', 'click_on_polygon', 'remove_poly',
        'mouseout', 'mouseover', 'show_polygons');
        this.mapview = this.options.mapview;
        this.report = this.options.report;
        this.operation = this.options.operation;
        this.poly_views = [];
        this.polygons = new PolygonCollection({        	
            report: this.report || '',
            operation: this.operation || '',
            x: this.options.x || 0,
            y: this.options.y || 0,
            z: this.options.z || 0
        });
        this.polygons.bind('add', this.add);
        this.polygons.bind('reset', this.addAll);
        this.polygons.bind('remove', this.remove_poly);
    //    this.polygons.fetch();
        this.editing_state = false;

    },

    add: function(poly) {
        var p = new PolygonView({model: poly, mapview: this.mapview});
        p.view = this;
        p.render();
        p.bind('click', this.click_on_polygon);
        p.bind('mouseover', this.mouseover);
        p.bind('mouseout', this.mouseout);
        this.poly_views.push(p);
    },

    mouseout: function(poly, e) {
        this.trigger('mouseout', poly, e);
    },

    mouseover: function(poly, e) {
        this.trigger('mouseover', poly, e);
    },

    create: function() {
        throw "use commit if you want to save models";
    },

    remove_poly: function(poly) {
        console.log('removing poly');
    },

    addAll: function() {
        this.polygons.each(this.add);
    },

    show_polygons: function(show) {
        if(show) {
            this.addAll();
        } else {
            this.remove();
        }
    },

    // called when user clicks on polygon
    click_on_polygon: function(poly) {
        if(this.editing_state) {
            var p = poly.model;
            // if is commited, remove it
            // or remove manually from collection
            window.loading_small.loading('removing polygon');
            p.destroy({
                success: function(model, response) {
                    window.loading_small.finished();
                }
            });

        } else {
            this.trigger('click_on_polygon', poly.model);
        }
    },

    // remove all polygons from map
    remove: function() {
        while(this.poly_views.length > 0) {
            this.poly_views[0].remove();
        }
    },

    commit: function() {
        var finished = function () {
            console.log("finished");
            window.loading.finished('polygons:commit');
        };
        this.polygons.each(function(p) {
            window.loading.loading('polygons:commit');
            p.save(null, {
                success: finished,
                error: finished
            });
        });
    }


});
