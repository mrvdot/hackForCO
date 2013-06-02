

for i (0 through 8)
  prefix = location.removesegmentsfromend(i) + shoutout + timestamp
  ndn.registerPrefix(prefix, publishClosure)
  
  
