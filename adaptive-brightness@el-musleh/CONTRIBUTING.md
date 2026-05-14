# Contributing to Adaptive Brightness

Thank you for your interest in improving the Adaptive Brightness applet! We welcome contributions to make this tool better for all Linux Mint users.

## Development Workflow

### 1. Setup Your Environment
- Clone the repository.
- Link the applet directory to your Cinnamon applets folder to test local changes:
  `ln -s $(pwd)/adaptive-brightness@el-musleh/files/adaptive-brightness@el-musleh ~/.local/share/cinnamon/applets/adaptive-brightness@el-musleh`

### 2. Testing Your Changes
- Use the provided test script to verify core functionality:
  `bash adaptive-brightness@el-musleh/TEST_DEVELOPMENT.sh`
- Restart Cinnamon to see changes: `Alt + F2` → `r` → `Enter`.
- Monitor logs for issues: `journalctl -f | grep "[AB]"`

### 3. Submitting Contributions
- Create a feature branch.
- Ensure all new features are documented and tested.
- Follow existing code style (clean, modular JS).
- Submit a Pull Request with a clear description of your changes.

## Development Guidelines
- **Modularity**: Keep logic within `applet.js` clean and modular.
- **Robustness**: Always wrap external commands and file I/O in try-catch blocks.
- **Logging**: Use `global.log("[AB] ...")` for debug statements to keep the system logs manageable.
- **Compatibility**: Test on multiple hardware types if possible.
