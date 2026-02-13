# Changelog

## [v1.0.1] - 2026-02-07

### Added

- Modularized graphing logic into new `colored_graph.py` module containing `DataSeries`, `DataCairoAxis`, `DataCairoGrid`, and `DataCanvas`.
- `MonitorNav` class in `monitor.py` to encapsulate application state and logic.
- `AppletArgs` dataclass for cleaner configuration and argument parsing.
- `pyproject.toml` for project metadata and python dependency management.
- Development tools including `mypy`, `pylint`, `flake8`, and `ruff` configuration.
- `dev_utils/setup_stubs.py` utility script for installing GTK stubs.
- Comprehensive type hinting and docstrings for better developer experience.

### Changed

- Refactored `monitor.py` to move drawing logic to `colored_graph.py` and implement an object-oriented architecture.

## [v1.0.0] - 2026-02-04

### Added

First functional implementation
