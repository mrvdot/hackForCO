var mapDebug;

require(["esri/map", "esri/geometry/Point", "esri/geometry/Multipoint", "esri/geometry/Polyline","esri/geometry/Polygon","esri/graphic", 
  "esri/symbols/SimpleMarkerSymbol", "esri/symbols/SimpleLineSymbol", "esri/symbols/SimpleFillSymbol", "esri/InfoTemplate", "./utils.js", "dojo/_base/Color", "dojo/on", "dojo/dom", "dojo/request", "dojo/domReady!"], 
  function(Map, Point, Multipoint, Polyline, Polygon, Graphic, SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, InfoTemplate, utils, Color, on, dom, request) {
    "use strict"

    // Create map
    var map
      , usng = org.mymanatee.common.usng
      , ndn
      , ndnSockets = []
      , wsport
      , pts
      , mapCoords = {}
      , mapDiv
      , excludedHashes = []
      , activeShouts
      , host = location.host.split(':')[0]
      , shoutTpl = '<div class="shout-box-wrapper">' + 
        '<div class="shout-box">' + 
          '<p class="shout" style="display:none;">$TEXT</p>' + 
        '</div>' + 
        '<i class="icon $CLASS">,</i>' + 
      '</div>';

    console.log('requesting to ',location.protocol + '//' + host + ':8080/socket');

    request(location.protocol + '//' + host + ':8080/socket').then(function (response) {
      var info = JSON.parse(response);
      wsport = info.socket;
      init();
    });

    jQuery(window).on('resize load', function () {
      if (!mapDiv) {
        mapDiv = jQuery('#myMap');
      };
      mapCoords = mapDiv.position();
    });

    var shoutCount = 0;

    function displayShout (shout, own) {
      console.log('displaying', shout);
      var className = own ? 'my-icon-shout-pin' : 'icon-shout-pin';
      var div = jQuery(shoutTpl.replace('$TEXT',shout.text).replace('$CLASS', className));
      var coords = shout.location;
      var pt = map.toScreen(new Point(coords.longitude, coords.latitude));
      div.css({
        zIndex : 1000 + shoutCount++,
        left : pt.x,
        top : pt.y
      });
      jQuery('.wrap').prepend(div).find('p').slideDown();
      setTimeout(function() {
        if (!activeShouts) {
          activeShouts = jQuery('.shout-box-wrapper');
        } else {
          activeShouts = activeShouts.add(div);
        }
      });
      setTimeout(function() {
        activeShouts = activeShouts.not(div);
        div.fadeOut();
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
      var name = new Name(n)
      var interest = new Interest(name)
      var template = {};
      var shoutCallback = function (ndn, name, content, moot) {
        console.log('shoutCallback');
        if (!ndn) {
          setTimeout(function () {
            monitorShouts(zone);
          }, 250);
          return;
        };
        console.log('content', DataUtils.toString(content));
        var shout = DataUtils.toString(content);
        shout = JSON.parse(shout);
        var hash = shout.text + shout.timestamp;
        if (jQuery.inArray(hash, excludedHashes) > -1) {
          return;
        } else {
          excludedHashes.push(hash);
        }
        displayShout(shout);
        exclusions.push(DataUtils.toNumbersFromString(moot));
        var newname = new Name(name);
        var interest = new Interest(newname);
        template.exclude = new Exclude(exclusions);
        interest.exclude = template.exclude
        ndn.expressInterest(newname, shoutClosure, template)
      }
      var shoutClosure = new ContentClosure(ndn, name, interest, shoutCallback)
      ndn.expressInterest(name, shoutClosure, template);
    }

    function shoutOut (shout) {
      var prefixComponents = centerZone.split('/');
      var prefix = 'Nei.ghbor.Net';
      excludedHashes.push(shout.text + shout.timestamp);
      displayShout(shout, true);
      for (var i=0; i<6 ; i++) { 
        prefix = prefix + '/' + prefixComponents[i];
        ndnSockets[i] = new NDN({host: host, port : wsport});
        
        var namePrefix = new Name(prefix + '/shoutout')
        var name = new Name(prefix + '/shoutout/' + shout.timestamp)
        var thisndn = ndnSockets[i];
        var signedInfo = new SignedInfo();
        signedInfo.freshnessSeconds = shout.timeout;
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

    function init () {
      ndn = new NDN({host: location.host.split(':')[0], port : wsport});
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
    }

    // Add point graphic
    function addPoint(pt, finished) {
      var attributes = {"Lat":pt.getLatitude().toFixed(2),"Lon":pt.getLongitude().toFixed(2)};
      var infoTemplate = new InfoTemplate("My Point","Latitude: ${Lat} <br/>Longitude: ${Lon}");
      var graphic = new Graphic(pt,pointSymbol,attributes,infoTemplate);
      map.graphics.add(graphic);
    }

    var lastDelta = {x : 0, y : 0};
    function bindEvents (map) {
      on(map, 'extent-change', function (extent, delta, levelChange, detail) {
        calculateZones(map.geographicExtent);
      });
      on(map, 'pan', function (extent) {
        if (!activeShouts) {
          return;
        };
        var d = extent.delta;
        moveShouts(d.x - lastDelta.x, d.y - lastDelta.y);
        lastDelta = d;  
      });//*/
      on(map, 'pan-end', function () {
        lastDelta = {x : 0, y : 0};
        removeLostShouts();
      });
      var zoomStartExtent;
      on(map, 'zoom-start', function (data) {
        zoomStartExtent = data.extent;
        hideShouts();
      });
      on(map, 'zoom-end', function (data) {
        repositionAndShowShouts(zoomStartExtent, data.extent, data.zoomFactor, data.anchor);
      });
    }

    function moveShouts (x, y) {
      activeShouts.css({
        left : '+=' + x + 'px',
        top : '+=' + y + 'px'
      });
    }

    function hideShouts () {
      if (!activeShouts) {
        return;
      };
      activeShouts.css('visibility','hidden');
    }

    function repositionAndShowShouts (start, end, factor, anchor) {
      if (!activeShouts) {
        return;
      };
      var x = anchor.x;
      var y = anchor.y;
      var mw = mapDiv.width();
      var mh = mapDiv.height();
      var shoutsToRemove = jQuery('.shouts.remove');
      activeShouts.each(function (idx, s) {
        s = jQuery(s);
        var spos = s.position();
        var newPos = {
          visibility : 'visible',
          left : spos.left + ((spos.left - x) * (factor - 1)),
          top : spos.top + ((spos.top - y) * (factor - 1))
        }
        if (false && (newPos.left < 0 || newPos.left > mw || newPos.top < 0 || newPos.top > mh)) {
          shoutsToRemove = shoutsToRemove.add(s);
        } else {
          s.css(newPos);
        }
      });
      if (shoutsToRemove.length) {
        //Really should drop out of excludes so we refetch them if we zoom back in
        activeShouts = activeShouts.not(shoutsToRemove);
        shoutsToRemove.remove();
      };
    }

    function removeLostShouts () {
      return;//using overflow for now - reexamine if number of shouts starts to hurt performance
      var mw = mapDiv.width();
      var mh = mapDiv.height();
      var shoutsToRemove = jQuery('.shouts.remove');
      activeShouts.each(function (idx, s) {
        s = jQuery(s);
        var spos = s.position();
        if (spos.left < 0 || spos.left > mw || spos.top < 0 || spos.top > mh) {
          shoutsToRemove = shoutsToRemove.add(s);
        }
      });
      if (shoutsToRemove.length) {
        activeShouts = activeShouts.not(shoutsToRemove);
        shoutsToRemove.remove();
      };
    }

    var sendShout = function (ev) {
      var text = $shoutInput.val();
      if (!text) {
        return;
      };
      setTimeout(function() {
        $shoutInput.val('');
      });
      var shout = {
        text : text,
        timeout : 60,
        location : centerLoc,
        timestamp : new Date().getTime()
      };
      shoutOut(shout);
    };
    
    var $shoutInput = jQuery('#shout').blur(sendShout);
    var $shoutButton = jQuery('.shoutBox i').click(sendShout);

  }
);
