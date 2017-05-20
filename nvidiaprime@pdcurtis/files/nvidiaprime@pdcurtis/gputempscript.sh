#!/bin/sh

# optirun -b none nvidia-settings -q GPUCoreTemp -t -c :8  > /tmp/.gpuTemperature
nvidia-settings -q GPUCoreTemp -t > /tmp/.gpuTemperaturePrime
exit 0
