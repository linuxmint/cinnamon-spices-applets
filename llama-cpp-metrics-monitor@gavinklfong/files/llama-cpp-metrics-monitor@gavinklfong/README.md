# Llama.cpp Token Rate Applet

A Cinnamon applet that displays real-time LLM inference metrics and system hardware statistics.

## Configuration

Settings can be configured through the Cinnamon applet settings dialog.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `metricsUrl` | Entry | `http://localhost:11434/metrics` | The full HTTP URL for your `llama-server` or Ollama metrics endpoint. |
| `llamaPollIntervalMs` | Spinbutton | `5000` | How frequently to refresh LLM metrics from the server (in milliseconds). |
| `hwPollIntervalMs` | Spinbutton | `1000` | How frequently to refresh hardware metrics from the system (in milliseconds). |

## Metrics Monitored

### LLM Inference Metrics
The applet calculates rates based on Prometheus metrics provided by the endpoint.

**Calculation Logic:**
To provide real-time feedback, the applet primarily uses a delta-based calculation:
`Rate = (Current Total Tokens - Last Total Tokens) / (Current Total Time - Last Total Time)`

If the delta-based calculation results in zero (for example, during the initial sample or when no new tokens have been processed), the applet falls back to the average rate provided directly by the server's Prometheus metrics.

* **Prompt Processing (PP) Rate**: Tokens processed per second (tok/s).
* **Token Generation (TG) Rate**: Tokens generated per second (tok/s).

*Internal metrics extracted from Prometheus:*
- `llamacpp:requests_processing`
- `llamacpp:prompt_tokens_total`
- `llamacpp:prompt_seconds_total`
- `llamacpp:prompt_tokens_seconds` (average)
- `llamacpp:tokens_predicted_total`
- `llamacpp:tokens_predicted_seconds_total`
- `llamacpp:predicted_tokens_seconds` (average)

### Hardware Statistics

#### System
- **CPU Load**: Current CPU utilization percentage.
- **CPU Temperature**: Maximum temperature among detected CPU cores.
- **RAM Usage**: Used and total RAM in GB, and usage percentage.

#### GPU (Dedicated & Integrated)
For each detected GPU:
- **Name**: The name of the GPU.
- **Temperature**: Maximum temperature among detected components.
- **Load**: Current GPU utilization percentage.
- **VRAM Usage**: Used and total VRAM in GB, and usage percentage.

## UI Display

The applet's interface dynamically adapts to your detected hardware configuration.

### Panel Label
The compact label on the Cinnamon panel shows token rates and key hardware stats:
- **Default (1 Dedicated GPU)**: `PP [rate] t/s | TG [rate] t/s | GPU: 🌡️[temp]°C ⚡[load]% | CPU: 🌡️[temp]°C ⚡[load]%`
- **Multi-GPU (Multiple Dedicated GPUs)**: `PP [rate] t/s | TG [rate] t/s | GPU: 🌡️[temp1]°C ⚡[load1]% | GPU: 🌡️[temp2]°C ⚡[load2]%`
- **Integrated Only (No Dedicated GPUs)**: `PP [rate] t/s | TG [rate] t/s | iGPU: 🌡️[temp]°C ⚡[load]% | CPU: 🌡️[temp]°C ⚡[load]%`

### Tooltip
Hovering over the applet provides a detailed breakdown:
1. **🧠 LLM Inference**: PP and TG rates.
2. **🎮 [DEDICATED GPU]**: Detailed stats (Name, Temp, Load, VRAM) for all detected dedicated GPUs.
3. **🧩 [INTEGRATED GPU]**: Detailed stats for detected integrated GPUs.
4. **💻 [SYSTEM]**: CPU temperature, CPU load, and RAM usage (Used/Total and %).

1. Copy this directory to `~/.local/share/cinnamon/applets/`.
2. Restart Cinnamon or reload applets to see the new applet.
3. Configure the `metricsUrl` to point to your running `llama.cpp` or Ollama server.
