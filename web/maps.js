var mapDebug;

require(["esri/map", "esri/geometry/Point", "esri/geometry/Multipoint", "esri/geometry/Polyline","esri/geometry/Polygon","esri/graphic", 
  "esri/symbols/SimpleMarkerSymbol", "esri/symbols/SimpleLineSymbol", "esri/symbols/SimpleFillSymbol", "esri/InfoTemplate", "./utils.js", "dojo/_base/Color", "dojo/on", "dojo/dom", "dojo/domReady!"], 
  function(Map, Point, Multipoint, Polyline, Polygon, Graphic, SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, InfoTemplate, utils, Color, on, dom) {
    "use strict"

    // Create map
    var map
      , usng = org.mymanatee.common.usng
      , ndn = new NDN({host: 'localhost'})
      , shoutSymbol = createShoutSymbol()
      , ownShoutSymbol = createOwnShoutSymbol()
      , polygonSymbol
      , multiPointGraphic
      , polylineGraphic
      , polygonGraphic
      , multiPoint
      , pts
      , activeToolId;

    function displayShout (shout, own) {
      var symbol = own ? ownShoutSymbol : shoutSymbol;
      var coords = shout.location;
      var pt = new Point(coords.longitude, coords.latitude);
      var attributes = {"Lat":coords.latitude.toFixed(2),"Lon":coords.longitude.toFixed(2)};
      var infoTemplate = new InfoTemplate("Shout!",shout.text);
      var graphic = new Graphic(pt,shoutSymbol,attributes,infoTemplate);
      map.graphics.add(graphic);
      setTimeout(function () {
        map.infoWindow.hide();
        map.graphics.remove(graphic);
      }, shout.timeout * 1000);
    }

    function usngToPrefix (loc) {
      var locationArray = loc.split(' ');
      var specificNorth = locationArray[2].split('');
      var specificEast = locationArray[3].split('');
      return locationArray[0] + '/' + locationArray[1] + '/' + specificNorth[0] + specificEast[0] + '/' + specificNorth[1] + specificEast[1] + '/' + specificNorth[2] + specificEast[2] + '/' + specificNorth[3] + specificEast[3] + '/';
    }
    var exclusions = [];

    function monitorShouts(zone) {
      var n = 'Nei.ghbor.Net' + zone + 'shoutout';
      console.log('monitoring shouts from',n);
      var name = new Name(n)
      var interest = new Interest(name)
      var template = {};
      var shoutCallback = function (ndn, name, content, moot) {
        console.log('shoutCallback', ndn, name);
        if (!ndn) {
          console.log('no ndn, exclusions',exclusions);
          setTimeout(function () {
            monitorShouts(zone);
          }, 250);
          return;
        };
        var shout = DataUtils.toString(content);
        shout = JSON.parse(shout);
        console.log(name, shout, moot);
        displayShout(shout);
        exclusions.push(DataUtils.toNumbersFromString(moot));
        console.log('exclusions', exclusions);
        var newname = new Name(name);
        var interest = new Interest(newname);
        template.exclude = new Exclude(exclusions);
        interest.exclude = template.exclude
        ndn.expressInterest(newname, shoutClosure, template)
      }
      var shoutClosure = new ContentClosure(ndn, name, interest, shoutCallback)
      ndn.expressInterest(name, shoutClosure, template);
    }

    var ShoutoutAsyncPutClosure = function (ndn, name, content, moot) {
      AsyncPutClosure.call(this);
      this.content = content;
      this.ndn = ndn;
      this.name = name;
      this.signed = signed;
    }

    ShoutoutAsyncPutClosure.prototype.upcall = function(ndn, name, content, timeout) {
      console.log('ShoutoutAsyncPutClosure', ndn, name, content, timeout);
    }

    function shoutOut (shout) {
      var prefixComponents = centerZone.split('/');
      var prefix = 'Nei.ghbor.Net';
      //displayShout(shout, true);
      for (var i=0; i<6 ; i++) { 
        prefix = prefix + '/' + prefixComponents[i];
        ndn[i] = new NDN({host: 'localhost'});
        
        var namePrefix = new Name(prefix + '/shoutout')
        var name = new Name(prefix + '/shoutout/' + shout.timestamp)
        var thisndn = ndn[i];
        var signedInfo = new SignedInfo();
        signedInfo.freshnessSeconds = shout.timeout;
        console.log('registering prefix', prefix + '/shoutout');
        if (NDN.CSTable[i] == undefined) {
          thisndn.registerPrefix(namePrefix, new AsyncPutClosure(thisndn, name, JSON.stringify(shout), signedInfo));
        } else {
          NDN.CSTable[i].closure.content = JSON.stringify(shout);
          NDN.CSTable[i].closure.name = name;
        }
      };
    }

    var currentBounds = {
      top : 0,
      right : 0,
      bottom : 0,
      left : 0
    };

    var topZone = '/'
      , centerZone = '/'
      , centerUSNG
      , centerLoc;

    function calculateZones (extent) {
      currentBounds.left = extent.xmin;
      currentBounds.right = extent.xmax;
      currentBounds.top = extent.ymax;
      currentBounds.bottom = extent.ymin;
      var tl = usngToPrefix(usng.LLtoUSNG(currentBounds.top, currentBounds.left, 4)).split('/');
      var tr = usngToPrefix(usng.LLtoUSNG(currentBounds.top, currentBounds.right, 4)).split('/');
      var bl = usngToPrefix(usng.LLtoUSNG(currentBounds.bottom, currentBounds.left, 4)).split('/');
      var br = usngToPrefix(usng.LLtoUSNG(currentBounds.bottom, currentBounds.right, 4)).split('/');
      var extCenter = extent.getCenter();
      centerLoc = {
        latitude : extCenter.y,
        longitude : extCenter.x
      };
      centerUSNG = usng.LLtoUSNG(extCenter.y, extCenter.x, 4);
      centerZone = usngToPrefix(centerUSNG);
      topZone = '/';
      var idx = 0;
      while(tl[idx] == tr[idx] && tl[idx] == bl[idx] && tl[idx] == br[idx]) {
        topZone += tl[idx] + '/';
        idx++;
      }
      monitorShouts(topZone);
    }

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(function(position) {
        var coords = centerLoc = position.coords;
        map = mapDebug = new Map("myMap",{ 
          basemap: "streets",
          center: [coords.longitude, coords.latitude],
          zoom: 12
        });
        utils.autoRecenter(map);
        bindEvents(map);
      });
    } else {
      map = new Map("myMap",{ 
        basemap: "streets",
        center: [-79.40, 43.55],
        zoom: 9,
      });
      utils.autoRecenter(map);
      //monitorShouts(coords);
    }

    // Add point graphic
    function addPoint(pt, finished) {
      var attributes = {"Lat":pt.getLatitude().toFixed(2),"Lon":pt.getLongitude().toFixed(2)};
      var infoTemplate = new InfoTemplate("My Point","Latitude: ${Lat} <br/>Longitude: ${Lon}");
      var graphic = new Graphic(pt,pointSymbol,attributes,infoTemplate);
      map.graphics.add(graphic);
    }
    
    function createShoutSymbol() {
      return new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 7,
        new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
        new Color("green", 1),
        new Color("green"))); 
    }

    function createOwnShoutSymbol() {
      return new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_DIAMOND, 7,
        new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
        new Color("blue", 1),
        new Color("blue"))); 
    }

    function clearAddGraphics() {
      map.infoWindow.hide();
      map.graphics.clear();
      multiPointGraphic = null;
      polylineGraphic = null;
      polygonGraphic = null;
      pts = null;
    }

    function bindEvents (map) {
      dojo.connect(map, 'onExtentChange', function (extent, delta, levelChange, detail) {
        calculateZones(map.geographicExtent);
      });
      map.on('click', function (evt) {
        map.centerAt(evt.mapPoint);
      });
    }

    var $shoutInput = jQuery('#shout').blur(function (ev) {
      var text = $shoutInput.val();
      if (!text) {
        return;
      };
      var shout = {
        text : text,
        timeout : 60,
        location : centerLoc,
        timestamp : new Date().getTime()
      };
      shoutOut(shout);
    });

  }
);
