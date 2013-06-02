Nei.ghbor.Net Shoutout
======================

Shoutout is the Nei.ghbor.Net teams entry into Hack4Colorado. It will be used to inform our development of the Lightning reference server and API.

Desired Function
================

Upon page load, users location is source via navigator.geolocate or similar.

A map is presented using the ESRI API at a tight zoom level. Beneath this map is a text input bar

Upon inputing text, hitting the submit button publishes the text to a ccn content object prefixed with a keystone scope derived from the map location and zoom level, the content object should contain the full location data of that user

Meanwhile, a recursive interest message is requesting 'shoutout' content objects according to the current scope of the map. when recieved, each shoutout is pinned to the map.

Bonus points: Use the Alchemy API to enforce a 'niceness threshhold' for shoutouts

PsuedoCode
==========

Init Map

Init NDN

NDN-get /keystone-scope/wide/shoutout, /keystone-scope/narrower/shoutout, /keystone-scope/narrowest/shoutout
  on recieved content, display on map, add to exclusions, and re-express interest

On event zoom-level-change, change keystone-scope and NDN-get

On event text-entered, update shoutout and publish to keystone-scoped prefix.
