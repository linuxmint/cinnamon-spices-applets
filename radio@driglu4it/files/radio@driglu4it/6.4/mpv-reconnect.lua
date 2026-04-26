-- Util to automatically reconnect on network change. 
-- Based on: https://github.com/mpv-player/mpv/issues/5793#issuecomment-2495268210 
local prev_pos = -1

function reload_if_disconnected()
  local pos = mp.get_property_number('time-pos')
  if pos == nil or pos == prev_pos then
    mp.commandv('loadfile', mp.get_property('path'), 'replace')
  else
    prev_pos = pos
  end
end

mp.add_periodic_timer(1, reload_if_disconnected)