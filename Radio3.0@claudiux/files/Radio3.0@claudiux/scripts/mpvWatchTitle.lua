-- This script is a part of the Radio3.0@claudiux applet.
-- Do not modify it. It will be replaced each time this applet is started.

local msg = require "mp.msg"
local utils = require "mp.utils"
--local utf8 = require "utf8"

local user = os.getenv("USER")
local runtime_dir = os.getenv("XDG_RUNTIME_DIR")
local pid_file_path = runtime_dir.."/mpv_radio_PID"
local title_file_path = runtime_dir.."/mpv_radio_title.txt"
local bitrate_file_path = runtime_dir.."/mpv_radio_bitrate.txt"
local codec_file_path = runtime_dir.."/mpv_radio_codec.txt"
local bitrate_values = {32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 448, 512, 640, 768, 896, 1024, 1280, 1536, 1792, 2048}
local old_bitrate = 0
local old_songname = ""
local old_codec = ""

function utf8format(fmt, ...)
   local args, strings, pos = {...}, {}, 0
   for spec in fmt:gmatch'%%.-([%a%%])' do
      pos = pos + 1
      local s = args[pos]
      if spec == 's' and type(s) == 'string' and s ~= '' then
         table.insert(strings, s)
         args[pos] = '\1'..('\2'):rep(#s:gsub("[\128-\191]", "")-1)
      end
   end
   return (fmt:format((table.unpack or unpack)(args))
      :gsub('\1\2*', function() return table.remove(strings, 1) end)
   )
end

function nearest_value(values, v)
  local smallestSoFar, smallestIndex
  for i, y in ipairs(values) do
    if not smallestSoFar or (math.abs(v-y) < smallestSoFar) then
      smallestSoFar = math.abs(v-y)
      smallestIndex = i
    end
  end
  return values[smallestIndex]
end

function write_pid()
  local pid = utils.getpid()
  local file = io.open(pid_file_path, "w")
  if file then
    file:write(pid, "") -- "\n"
    --msg.info("PID: "..pid)
    file:close()
  else
    msg.error("Failed to open "..pid_file_path..". Check path and permissions.")
  end
end

function write_song(songname)
  if songname == old_songname then return end
  old_songname = songname
  local file = io.open(title_file_path, "w")
  if file then
    --file:write(string.format([[%s]], songname), "") -- "\n"
    file:write(utf8format("%30s", songname), "")
    --msg.info("Saved: "..songname)
    file:close()
  else
    msg.error("Failed to open "..title_file_path..". Check path and permissions.")
  end
end

function titlechanged(_, title)
  local f = mp.get_property("filename")
  if title ~= f then
    write_song(title)
  end
end

function write_bitrate(bitrate)
  --if songname == old_songname then return end
  --old_songname = songname
  local file = io.open(bitrate_file_path, "w")
  if file then
    file:write(bitrate, "") -- "\n"
    --msg.info("Saved: "..bitrate)
    file:close()
  else
    msg.error("Failed to open "..bitrate_file_path..". Check path and permissions.")
  end
end

function bitratechanged(_, bitrate)
  if bitrate == nil then return end
  local kbps = ""..1000*nearest_value(bitrate_values, math.floor(bitrate / 1000))

  --~ msg.info("kbps: "..kbps)
  local f = mp.get_property("filename")
  --~ msg.info("f: "..f)
  --~ msg.info("old_bitrate: "..old_bitrate)
  if f == nil then return end
  if kbps ~= f then
    --~ if math.abs(bitrate)<640000 then
      --~ msg.info("diff: "..(math.abs(0 + kbps - old_bitrate)))
      if math.abs(0 + kbps - old_bitrate)>0 then
        write_bitrate(kbps)
        old_bitrate = 0+kbps
      end
    --~ else
      --~ if old_bitrate<640000 then
        --~ write_bitrate(640000)
      --~ end
      --~ old_bitrate = 640000
    --~ end
  end
end

function write_codec(codec)
  if codec == old_codec then return end

  local file = io.open(codec_file_path, "w")
  if file then
    file:write(codec, "")
    --msg.info("Saved: "..codec)
    file:close()
  else
    msg.error("Failed to open "..codec_file_path..". Check path and permissions.")
  end
end

function codecchanged(_, codec)
  local f = mp.get_property("filename")
  if codec ~= f then
    write_codec(codec)
    old_codec = codec
  end
end

write_pid()

mp.observe_property("media-title", "string", titlechanged)
mp.observe_property("audio-codec-name", "string", codecchanged)
mp.observe_property("audio-bitrate", "number", bitratechanged)
