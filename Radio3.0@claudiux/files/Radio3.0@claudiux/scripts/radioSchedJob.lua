-- This script is a part of the Radio3.0@claudiux applet.
-- Do not modify it!

function myOsExecute(command)
  local tmpFileName = os.tmpname ()
  local cmd=command..' > '..tmpFileName..' 2>&1'
  local response=os.execute(cmd)
  local file=assert(io.open(tmpFileName, "r"))
  local stdout=file:read("*all")
  assert(file:close())
  os.execute("rm -f "..tmpFileName)
  return (response==0 or response==true), stdout
end

function getATjobId(scriptfile, datetime)
  local success, jobId = myOsExecute(os.getenv("HOME").."/.local/share/cinnamon/applets/Radio3.0@claudiux/scripts/create-job.sh "..scriptfile.." "..datetime)
  if success then
    return jobId
  end
  return "0"
end

local msg = require "mp.msg"
local utils = require "mp.utils"

local user = os.getenv("USER")
local home = os.getenv("HOME")
local icon = home.."/.local/share/cinnamon/applets/Radio3.0@claudiux/icon.svg"

local options = require "mp.options"
local job_options = {
  BT = "", -- Begin Time
  ET = "", -- End Time
  EM = "", -- End Message
  RN = "", -- Radio Name
  ID = ""  -- record's UUID
}

options.read_options(job_options, "jobscript")

local jobs_dir = home.."/.config/Radio3.0/scheduled-jobs"

local pid = utils.getpid()
local pid_file_path = jobs_dir.."/pid_"..job_options.ID

local begin_time = string.gsub(job_options.BT, "%.", "")
local begin_job_file_path = jobs_dir.."/job_"..begin_time.."_"..job_options.ID
local begin_job_file = io.open(begin_job_file_path, "r")

if not begin_job_file then os.exit(0) end

begin_job_file:close()

local end_time = string.gsub(job_options.ET, "%.", "")
local end_job_file_path = jobs_dir.."/job_"..end_time.."_"..job_options.ID

local desc_job_file_path = jobs_dir.."/desc_"..begin_time.."_"..end_time.."_"..job_options.ID..".json"

local pid_file_contents = [[{
  "]]..job_options.ID..[[": {
    "pid": "]]..pid..[[",
    "begin": "]]..begin_time..[[",
    "end": "]]..end_time..[["
  }
}
]]

local pid_file = io.open(pid_file_path, "w")
if pid_file then
  pid_file:write(pid_file_contents)
  pid_file:close()
end

local job_file = io.open(end_job_file_path, "w")
if job_file then
  job_file:write("kill -15 "..pid, "\n")
  --~ job_file:write("[[ -f "..jobs_dir.."/idEnd_"..job_options.ID.." ]] && /usr/bin/notify-send -u low -i "..icon.." \""..job_options.RN.."\" \""..job_options.EM.."\"", "\n")
  job_file:write("/usr/bin/notify-send -u low -i "..icon.." \""..job_options.RN.."\" \""..job_options.EM.."\"", "\n")
  job_file:write("rm -f "..jobs_dir.."/*"..job_options.ID.."*", "\n")
  --~ job_file:write("rm -f "..pid_file_path, "\n")
  --~ job_file:write("rm -f "..begin_job_file_path, "\n")
  --~ job_file:write("rm -f "..end_job_file_path, "\n")
  job_file:close()
  --~ os.execute("/usr/bin/at -M -f "..end_job_file_path.." -t "..job_options.ET)

  local jobId = getATjobId(end_job_file_path, job_options.ET)

  if jobId ~= "0" then
    local jobId_file_path = jobs_dir.."/idEnd_"..job_options.ID
    local jobId_file = io.open(jobId_file_path, "w")
    if jobId_file then
      jobId_file:write(jobId, "")
      jobId_file:close()
    else
      msg.error("Failed to open "..jobId_file_path..". Check path and permissions.")
    end
  end
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
