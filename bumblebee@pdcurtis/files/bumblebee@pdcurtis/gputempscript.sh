#!/bin/sh

  optirun -b none nvidia-settings -q GPUCoreTemp -t -c :8  > /tmp/.gpuTemperatureBB
# nvidia-settings -q GPUCoreTemp -t  > /tmp/.gpuTemperature
exit 0
