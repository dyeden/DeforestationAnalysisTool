
var Result = Backbone.Model.extend({
});

var SearchResults = Backbone.Collection.extend({
    model: Result,

    initialize: function() {
        this.geocoder = new google.maps.Geocoder();
    },

    fetch: function() {
        var self = this;
        this.geocoder.geocode( { 'address': this.to_search }, function(results, status) {
          if (status == google.maps.GeocoderStatus.OK) {
            self.reset(results);
          }
        });
    }

});

var Searchbox = Backbone.View.extend({

    el: $("#searchbox"),

    events: {
        'change #to_search': 'typing',
        'click li a': 'goto',
        'click #icon': 'show',
        'click #open_close_trigger': 'toggle'
    },

    initialize: function() {
        _.bindAll(this, 'typing', 'render', 'goto', 'show', 'close', 'toggle', 'keyPress');
        this.results = new SearchResults();
        this.to_search = this.$('#to_search');
        this.results.bind('reset', this.render);
        this.results_ul = this.$('#results');
        this.results_ul.jScrollPane({autoReinitialise:true});
        this.results_ul.find('div.jspPane').sortable({
          revert: false,
          axis: 'y',
          cursor: 'pointer'
        });
        this.results_ul = this.results_ul.find('div.jspPane');
        $(document).bind('keydown', this.keyPress);
    },

    typing: function() {
        this.results.to_search =  this.to_search.val();
        this.results.fetch();
    },

    render: function() {
        var self = this;
        console.log(this.results.models);
        this.results_ul.html('');
        this.$('#small').addClass('big');
        // add empty row at top to show small gray border in the first result
        self.results_ul.append('<li></li>');
        this.results.each(function(r) {
            var ll = r.get('geometry').location;
            var ll_str = ll.lat() + "," + ll.lng();
            self.results_ul.append(
                '<li><a href="#' + ll_str + '">' + r.get('formatted_address') + '</a></li>'
            );
        });
        var h = 0;
        this.$('li').each(function() {
            h += $(this).outerHeight();
        });
        this.$('#hack').css({height: Math.min(216, h + 8)});
    },

    goto: function(e) {
        e.preventDefault();
        var a = $(e.target).attr('href').slice(1).split(',');
        this.trigger('goto', new google.maps.LatLng(a[0], a[1]), 10);
    },

    show: function() {
        this.$("#small").show();
    },

    close: function() {
        this.$("#small").hide();
    },

    toggle: function() {
        this.$("#small").toggle();
    },

    keyPress: function(e) {
        //if(e) e.preventDefault();
        if (e.keyCode == 27) { //lovely
            this.close();
        }
    }


});
