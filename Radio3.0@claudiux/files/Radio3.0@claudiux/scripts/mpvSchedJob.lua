-- This script is a part of the Radio3.0@claudiux applet.
-- Do not modify it. It will be replaced each time this applet is started.

local msg = require "mp.msg"
local utils = require "mp.utils"

local user = os.getenv("USER")
local home = os.getenv("HOME")
local icon = home.."/.local/share/cinnamon/applets/Radio3.0@claudiux/icon.svg"

local options = require "mp.options"
local job_options = {
  opBT = "", -- Begin Time
  opET = "", -- End Time
  opEM = "", -- End Message
  opRN = "" -- Radio Name
}

options.read_options(job_options, "jobscript")
--~ msg.info("opBT: "..job_options.opBT)
--~ msg.info("opET: "..job_options.opET)


local pid = utils.getpid()
local begin_time = string.gsub(job_options.opBT, "%.", "")
local begin_job_file_path = home.."/.config/Radio3.0/scheduled-jobs/job_"..begin_time
local end_time = string.gsub(job_options.opET, "%.", "")
local end_job_file_path = home.."/.config/Radio3.0/scheduled-jobs/job_"..end_time
local desc_job_file_path = home.."/.config/Radio3.0/scheduled-jobs/desc_"..begin_time.."_"..end_time..".json"
local job_file = io.open(end_job_file_path, "w")
if job_file then
  job_file:write("kill -15 "..pid, "\n")
  job_file:write("/usr/bin/notify-send -u low -i "..icon.." \""..job_options.opRN.."\" \""..job_options.opEM.."\"", "\n")
  job_file:write("rm -f "..desc_job_file_path, "\n")
  job_file:write("rm -f "..begin_job_file_path, "\n")
  job_file:write("rm -f "..end_job_file_path, "\n")
  job_file:close()
  os.execute("/usr/bin/at -M -f "..end_job_file_path.." -t "..job_options.opET)
else
  msg.error("Failed to open "..end_job_file_path..". Check path and permissions.")
end

--~ local pid_file_path = "/tmp/"..user.."_mpv_radio_PID"
--~ local title_file_path = "/tmp/"..user.."_mpv_radio_title.txt"
--~ --local oldsongname = ""

--~ function write_pid()
  --~ local pid = utils.getpid()
  --~ local file = io.open(pid_file_path, "w")
  --~ if file then
    --~ file:write(pid, "") -- "\n"
    --~ msg.info("PID: "..pid)
    --~ file:close()
  --~ else
    --~ msg.error("Failed to open "..pid_file_path..". Check path and permissions.")
  --~ end
--~ end

--~ function write_song(songname)
  --~ --if songname == oldsongname then return end
  --~ --oldsongname = songname
  --~ local file = io.open(title_file_path, "w")
  --~ if file then
    --~ file:write(songname, "") -- "\n"
    --~ msg.info("Saved: "..songname)
    --~ file:close()
  --~ else
    --~ msg.error("Failed to open "..title_file_path..". Check path and permissions")
  --~ end
--~ end

--~ function titlechanged(_, title)
  --~ local f = mp.get_property("filename")
  --~ if title ~= f then
    --~ write_song(title)
  --~ end
--~ end

--~ write_pid()

--~ mp.observe_property("media-title", "string", titlechanged)
