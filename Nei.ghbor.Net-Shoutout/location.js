var prefix, prefixComponents, locationPrefix, geoLocation, locationArray, specificNorth, specificEast, userPosition;


var ndn = {}
var host = location.host.split(':')[0]



if ("geolocation" in navigator) {
  /* geolocation is available */
  alert('anywhere');
  navigator.geolocation.getCurrentPosition(function(position) {
    alert('here!');
    geoLocation = org.mymanatee.common.usng.LLtoUSNG(position.coords.latitude, position.coords.longitude, 4);
    locationArray = geoLocation.split(' ');
    specificNorth = locationArray[2].split('');
    specificEast = locationArray[3].split('');
    locationPrefix = locationArray[0] + '/' + locationArray[1] + '/' + specificNorth[0] + specificEast[0] + '/' + specificNorth[1] + specificEast[1] + '/' + specificNorth[2] + specificEast[2] + '/' + specificNorth[3] + specificEast[3] + '/'
    console.log('locationPrefix: ', locationPrefix);
    var testshout = {}; 
    testshout.text = 'This is A hardcoded test shoutout'; 
    testshout.timeout = 10;
    userPosition = position.coords;
    //shoutOut(testshout);
    }
  );

} else {
  alert('NOGEO!');
  /* geolocation IS NOT available */
}

var shoutOut = function (shout) {
  prefixComponents = locationPrefix.split('/');
  prefix = 'Nei.ghbor.Net';
  for (var i=0; i<6 ; i++) { 
    prefix = prefix + '/' + prefixComponents[i];
    ndn[i] = new NDN({host: host});
    
    var namePrefix = new Name(prefix + '/shoutout')
    var name = new Name(prefix + '/shoutout/' + shout.timestamp)
    console.log(prefix);
    var thisndn = ndn[i];
    console.log(JSON.parse(JSON.stringify(shout)));
    var signedInfo = new SignedInfo();
    signedInfo.freshnessSeconds = shout.timeout;
    if (NDN.CSTable[i] == undefined) {
      thisndn.registerPrefix(namePrefix, new AsyncPutClosure(thisndn, name, JSON.stringify(shout), signedInfo));
    } else {
      NDN.CSTable[i].closure.content = JSON.stringify(shout);
      NDN.CSTable[i].closure.name = name;
    }
    console.log(NDN.CSTable)
    
  };
};


