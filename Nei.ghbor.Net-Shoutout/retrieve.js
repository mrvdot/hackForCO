

name = new Name(locationPrefix + '/shoutout')
exlusions = []

GetClosure = (name, exlusions)
  
  //Alex
  pinToMap(upcallinfo.contentObject, upcallinfo.timeToStaleness)
  timestamp = upcallinfo.contentObject.name.segment(scope+2)
  exclusions.push(timestamp)  
  name.exlude = new Exlusion(exlusions)
  ndn.expressInterest(name, GetClosure)
  
ndn.expressInterest(name, GetClosure)

