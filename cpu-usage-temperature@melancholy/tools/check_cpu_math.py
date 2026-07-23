#!/usr/bin/env python3

def usage(prev_idle, prev_total, idle, total):
    total_delta = total - prev_total
    idle_delta = idle - prev_idle
    return round((1 - idle_delta / total_delta) * 100)


def temperature_status(temp, high=None, critical=None):
    if critical is not None and temp >= critical:
        return "critical"
    if high is not None and temp >= high:
        return "high"
    return None


def label(cpu, temp, temp_label="Temp:", single_line=False, separator=" ", status=None):
    temp_line = f"{temp_label} {temp}" if temp_label else temp
    if status:
        temp_line = f"{temp_line} {status}"
    if single_line:
        return f"CPU: {cpu}%{separator}{temp_line}"
    return f"CPU: {cpu}%\n{temp_line}"


def main():
    assert usage(100, 200, 150, 300) == 50
    assert usage(100, 200, 100, 300) == 100
    assert usage(100, 200, 200, 300) == 0
    assert temperature_status(81, high=82, critical=100) is None
    assert temperature_status(82, high=82, critical=100) == "high"
    assert temperature_status(100, high=82, critical=100) == "critical"
    assert label(9, "61°C") == "CPU: 9%\nTemp: 61°C"
    assert label(61, "83°C", status="High") == "CPU: 61%\nTemp: 83°C High"
    assert label(9, "61°C", temp_label="", single_line=True, separator="  ") == "CPU: 9%  61°C"


if __name__ == "__main__":
    main()
