

    // google maps map
var MapView = Backbone.View.extend({
    mapOptions: {
            zoom: 5,
            center: new google.maps.LatLng(-6.653695352486294, -58.743896484375),
            mapTypeId: google.maps.MapTypeId.TERRAIN,
            disableDefaultUI: true,
            disableDoubleClickZoom: true,
            draggableCursor:'default',
            scrollwheel: false,
            mapTypeControl:false
            /*mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
                position: google.maps.ControlPosition.BOTTOM_LEFT
            }*/
    },

    events: {
            'click .layer_raster': 'open_layer_editor',
            'click .layer_google_maps': 'open_google_maps_base_layer_editor',
            'click .zoom_in': 'zoom_in',
            'click .zoom_out': 'zoom_out'
    },
    //el: $("#map"),

    initialize: function() {
        _.bindAll(this, 'center_changed', 'ready', 'click', 'set_center', 'reoder_layers', 'open_layer_editor', 'zoom_changed', 'zoom_in', 'zoom_out', 'adjustSize', 'set_zoom_silence', 'set_center_silence', 'close_layer_editor', 'open_google_maps_base_layer_editor');
       this.map_layers = {};
       // hide controls until map is ready
       this.hide_controls();
       this.map = new google.maps.Map(this.$('.map')[0], this.mapOptions);
       google.maps.event.addListener(this.map, 'center_changed', this.center_changed);
       google.maps.event.addListener(this.map, 'zoom_changed', this.zoom_changed);
       google.maps.event.addListener(this.map, 'click', this.click);
       this.zoom_level = '0';
       this.operation_map = 'sad';
       //google.maps.event.addListener(this.map, 'idle', this.tilesloaded);
       this.projector = new Projector(this.map);
       this.projector.draw = this.ready;
       this.layers = new LayerCollection();       
       this.signals_on = true;
       this.layer_dialog_pos= this.options.layer_dialog_pos || 'top';

    },

    adjustSize: function() {
        google.maps.event.trigger(this.map, "resize");
        if(this.layer_editor) {
            this.layer_editor.close();
        }

    },

    hide_controls: function() {
        this.$('.layer_editor').hide();
        this.$('.zoom_control').hide();
    },

    show_zoom_control: function() {
        this.$('.zoom_control').show();
    },

    hide_zoom_control: function() {
        this.$('.zoom_control').hide();
    },

    show_layers_control: function() {
        this.$('.layer_editor').show();
    },

    hide_layers_control: function() {
        this.$('.layer_editor').hide();
    },

    show_controls: function() {
        this.$('.layer_editor').show();
        this.$('.zoom_control').show();
    },

    center_changed: function() {
        if(this.signals_on) {
            this.trigger('center_changed', this.map.getCenter());
        }
    },

    zoom_in: function(e) {
        e.preventDefault();
        this.map.setZoom(this.map.getZoom() + 1);
    },

    zoom_out: function(e) {
        e.preventDefault();
        this.map.setZoom(this.map.getZoom() - 1);
    },

    zoom_changed: function() {
        if(this.signals_on) {
            this.trigger('zoom_changed', this.map.getZoom());
        }
    },

    set_center: function(c, s) {
        this.signals_on = s === undefined? true: s;
        this.map.setCenter(c);
        this.signals_on = true;
    },

    set_center_silence: function(c) {
        this.set_center(c, false);
    },

    set_zoom: function(z, s) {
        this.signals_on = s === undefined? true: s;
        this.map.setZoom(z);
        this.signals_on = true;
    },

    set_zoom_silence: function(z) {
        this.set_zoom(z, false);
    },

    click: function(e) {
            this.close_layer_editor();
            this.trigger('click', e);
    },

    crosshair: function(onoff) {
        var c = this.$('.crosshair');
        if(onoff) {
            c.show();
        } else {
            c.hide();
        }
    },
    reload_layers: function(level, bound){
        this.layers.url = 'map/level/'+level+'/'+bound+'/'
        var that = this;
        this.layers.fetch({
            success: function(){
                that.setting_layer_in_level(level);
            }
        });
    },
    setting_layer_in_level: function(level){
        if(level == '0'){
            this.layers.update_visibility_with_type(false, 'processed');
            this.layers.update_visibility_with_type(false, 'analysis');
        }
        else if(level == '1'){
            this.layers.update_visibility_with_type(true, 'processed');
            this.layers.update_visibility_with_type(false, 'analysis');
        }
        else if(level == '2'){
            this.layers.update_visibility_with_type(true, 'analysis');
        }
    },
    //close layer editor if it's opened
    close_layer_editor: function() {
        if(this.layer_editor !== undefined && this.layer_editor.showing) {
            this.open_layer_editor();
        }
        if(this.layer_editor_base !== undefined && this.layer_editor_base.showing) {
            this.open_google_maps_base_layer_editor();
        }
    },
    open_google_maps_base_layer_editor: function(e) {
            if(e) e.preventDefault();            
            if(this.layer_editor_base === undefined) {
                this.layer_editor_base = new LayerEditorGoogleMaps({
                    parent: this.el,
                    layers: this.layers
                });
            }


            if(this.layer_editor_base.showing) {
                this.layer_editor_base.close();
                var view_bkg = {'background-image': "url('/static/img/layers_editor.png')"};
                this.$(".layer_raster").css(view_bkg);
                this.$(".layer_google_maps").css(view_bkg);
            } else {
                if(this.layer_editor !== undefined && this.layer_editor.showing) {
                    this.open_layer_editor();
                }
                var view_bkg = {'background-image': "url('/static/img/layer_editor_google_maps_selected.png')"};
                this.$(".layer_raster").css(view_bkg);
                this.$(".layer_google_maps").css(view_bkg);
                //this.trigger('open_layer_editor_base');
                this.layer_editor_base.show(this.$('.layer_editor').position(),
                    this.layer_dialog_pos);

            }
    },
    reset_layers_map: function(level, layer, operation_map) {
    	this.layers        = layer;
    	this.zoom_level    = level;
    	this.operation_map = operation_map; 
    	this.layer_editor  = undefined;
	},
    open_layer_editor: function(e) {
            if(e) e.preventDefault();            
            if(this.layer_editor === undefined) {
                //console.log(this.layer_editor);
                this.layer_editor = new LayerEditor({
                    parent:        this.el,
                    layers:        this.layers,
                    zoom_level:    this.zoom_level,
                    operation_map: this.operation_map
                });
            }
            
            console.log(this.layers);
           
            if(this.layer_editor.showing) {
                this.layer_editor.close();
                var view_bkg = {'background-image': "url('/static/img/layers_editor.png')"};
                this.$(".layer_raster").css(view_bkg);
                this.$(".layer_google_maps").css(view_bkg);
            } else {
                if(this.layer_editor_base !== undefined && this.layer_editor_base.showing) {
                    this.open_google_maps_base_layer_editor();
                }
                this.layer_editor.layers = this.layers;
                var that = this;
                this.layer_editor.layers.each(function(m){
                    if(!m.get('visibility')){
                        that.layer_editor.layers.remove(m);
                    }
                });
                var view_bkg = {'background-image': "url('/static/img/layer_editor_raster_selected.png')"};
                this.$(".layer_raster").css(view_bkg);
                this.$(".layer_google_maps").css(view_bkg);
                this.trigger('open_layer_editor');
                this.layer_editor.show(this.$('.layer_editor').position(), this.layer_dialog_pos);
            }
    },
    show_sad_info: function(report, zoom){
    	
    	if(zoom == '1'){ 
		    $("#map_info h3#base_name").html('');
		    $("#map_info h3#base_period").html('');
		    $("#map_info h3#base_name").html('Baseline: '+report.get('assetid'));
		    var start = moment(new Date(report.get('str'))).format("DD/MMM/YYYY");
		    var end   = moment(new Date(report.get('str_end'))).format("DD/MMM/YYYY");
		
		    $("#map_info h3#base_period").html('Period: '+start+' to '+end);
		
		
		    $("#map_info").show();
        }
        else{
        	$("#map_info").hide();
        }
    },    
    tile_info: function(info) {
        var nfo = this.$('.tiles_info');
        if(info.length > 0) {
            nfo.animate({ bottom: 0});
            nfo.find('span').html(info);
        } else {
            nfo.animate({bottom: -171});
        }
    },

    // called when map is ready
    // its a helper method to avoid calling getProjection whiout map loaded
    ready: function() {
            this.projector.draw = function(){};
            this.layers.bind('reset', this.reoder_layers);
            this.layers.bind('add', this.reoder_layers);
            this.layers.bind('remove', this.reoder_layers);
            this.show_controls();
            this.trigger('ready');
            this.layers.trigger('reset');
    },

    enable_layer: function(idx) {
    },

    // the next two functions are an EPIC PIECE OF SHIT
    reoder_layers: function() {
        var self = this;
        var idx = 0;
        self.map.overlayMapTypes.clear();
        var lyrs = self.layers.models;
        for(var i=0; i< lyrs.length; ++i) {
            var layer = lyrs[lyrs.length - i - 1];
            var index = i;
            var lyr;
            if(layer.get('type') === 'fake') {
                //i'm very sorry
            } else if(layer.get('type') === 'google_maps') {
                if(layer.enabled) {
                    var id = google.maps.MapTypeId[layer.get('map_id')];
                    self.map.setOptions({mapTypeId: id});
                }
                layer.unbind('change', self.reoder_layers);
                layer.bind('change', self.reoder_layers);
            }
            else if(layer.map_layer === undefined) {
                lyr = self.create_layer(layer.toJSON());
                layer.map_layer = lyr;
                //layer.map_position = idx;
                layer.bind('change', self.reoder_layers);
            } else if(layer.get('type') === 'custom') {
                //custom layers has map_layer created so
                //we need to bind.
                //as bacbone doesn't have a bind_once unbind first
                //and the bind to no bond twice
                layer.unbind('change', self.reoder_layers);
                layer.bind('change', self.reoder_layers);
            }
            lyr = layer.map_layer;
            if(lyr) {
                if(layer.get('type') === 'fusion_tables') {
                    // fusion tables can't be added as overlayMapTypes
                    if(layer.enabled) {
                        lyr.setMap(self.map);
                    } else {
                        lyr.setMap(null);
                    }
                } else {
                    if(layer.enabled) {
                        self.map.overlayMapTypes.setAt(idx, lyr);
                        idx ++;
                    }
                }
            }
        }
    },

    create_layer: function(model_layer) {
        var layer;
        var type = model_layer.type;
        var url = model_layer.url;
        if (type === '') {
          if (url.search('.kml') != -1 || url.search('.kmz') != -1) {
            type = 'kml';
          } else {
            type = 'xyz';
          }
        }

        if (type === 'kml') {
            layer = new google.maps.KmlLayer(url, { suppressInfoWindows: true, preserveViewport:true});
        } else if (type === 'fusion_tables') {
            layer = new google.maps.FusionTablesLayer({
              query: {
                select: model_layer.select,
                from: model_layer.table
              }
            });
        } else if(type === 'custom') {
            layer = model_layer.layer;
        } else { //xyz
            if (url && url.search('{X}') != -1 && url.search('{Z}') != -1 && url.search('{Y}') != -1) {
                  layer = new google.maps.ImageMapType({
                      getTileUrl: function(tile, zoom) {
                        var y = tile.y;
                        var tileRange = 1 << zoom;
                        if (y < 0 || y  >= tileRange) {
                          return null;
                        }
                        var x = tile.x;
                        if (x < 0 || x >= tileRange) {
                          x = (x % tileRange + tileRange) % tileRange;
                        }
                        return this.urlPattern.replace("{X}",x).replace("{Y}",y).replace("{Z}",zoom);
                      },
                      tileSize: new google.maps.Size(256, 256),
                      opacity: 1.0,
                      isPng: true,
                      urlPattern:url
               });
            }
        }
        return layer;
    }


});
