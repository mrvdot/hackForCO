var locationPrefix
var shoutOut = 'This is ANOTHER hardcoded test shoutout'; 
var ndn = {}
var host = location.host.split(':')[0]
alert('theotherplace');
if ("geolocation" in navigator) {
  /* geolocation is available */
  alert('anywhere');
  navigator.geolocation.getCurrentPosition(function(position) {
    alert('here!');
    var location = org.mymanatee.common.usng.LLtoUSNG(position.coords.latitude, position.coords.longitude, 4);
    var locationArray = location.split(' ');
    var specificNorth = locationArray[2].split('');
    var specificEast = locationArray[3].split('');
    locationPrefix = locationArray[0] + '/' + locationArray[1] + '/' + specificNorth[0] + specificEast[0] + '/' + specificNorth[1] + specificEast[1] + '/' + specificNorth[2] + specificEast[2] + '/' + specificNorth[3] + specificEast[3] + '/'
    console.log('locationPrefix: ', locationPrefix);
    var prefix = 'Nei.ghbor.Net';
    var prefixComponents = locationPrefix.split('/');
    for (var i=0 ; i<6 ; i++) { 
      var prefix = prefix + '/' + prefixComponents[i];
      ndn[i] = new NDN({host: host});
      var namePrefix = new Name(prefix + '/shoutout')
      var name = new Name(prefix + '/shoutout/' + new Date().getTime())
      
      var thisndn = ndn[i];
      var shoutClosure = function (name, shoutOut) {
        Closure.call(this);
        this.name = name;
        this.upcall   
      };
      shoutClosure.prototype.upcall = function(kind, upcallInfo) {
			if (kind == Closure.UPCALL_FINAL) {
				  // Do nothing.
			  } else if (kind == Closure.UPCALL_INTEREST) {
				  console.log('shoutClosure.upcall() called.');
                  console.log("Host: " + thisndn.host + ":" + thisndn.port);
				  var content = shoutOut;
				  var interest = upcallInfo.interest;
				  var nameStr = interest.name.getName();
          console.log(this.name);
				  var si = new SignedInfo();
          console.log(interest)
			  	if (interest.matches_name(this.name) == true) {
	        	console.log('si',si);
	        	var co = new ContentObject(this.name, si, content, new Signature());
	        	co.sign();
	        	console.log('co',co);
	        	upcallInfo.contentObject = co;
	        	return Closure.RESULT_INTEREST_CONSUMED;
	        }
			  }
			  return Closure.RESULT_OK;
		  };
      var signedInfo = new SignedInfo();
      
      ndn[i].registerPrefix(namePrefix, new AsyncPutClosure(ndn[i], name, shoutOut, signedInfo));
      console.log(prefix);
    }
  });

} else {
  alert('NOGEO!');
  /* geolocation IS NOT available */
}


/*

location = getlatlng.toMGRS.toPrefix
          //ESRI    //RYAN
maploc = getMapCenter.toMGRS

 
        //ESRI    //RYAN
scope = getMapZoom.ToMGRSlevel // returns INT 1 through 8

                        //RYAN
shoutoutPrefix = maploc.chop(scope)*/
