const { GdkPixbuf } = imports.gi

export function getFrameSizeOfSlicedImage(
  file: imports.gi.Gio.File,
  frames: number,
): { width: number; height: number } {
  if (!Number.isInteger(frames) || frames < 0) {
    throw new Error(`Invalid frames value: ${frames}`)
  }

  const pixbuf = getPixbufFromFile(file)

  const imageWidth = pixbuf.get_width()
  const imageHeight = pixbuf.get_height()
  const frameWidth = imageWidth / frames
  const frameHeight = imageHeight

  if (!Number.isInteger(frameWidth) || !Number.isInteger(frameHeight)) {
    throw new Error(
      `Invalid frame dimensions: width=${frameWidth}, height=${frameHeight}. Ensure the image dimensions are divisible by the number of frames.`,
    )
  }

  return {
    width: frameWidth,
    height: frameHeight,
  }
}

export function getPixbufFromFile(file: imports.gi.Gio.File): imports.gi.GdkPixbuf.Pixbuf {
  if (!file.query_exists(null)) {
    throw new Error(`File does not exist: ${file}`)
  }

  const filePath = file.get_path()
  if (!filePath) {
    throw new Error(`File path is null.`)
  }

  const pixbuf = GdkPixbuf.Pixbuf.new_from_file(filePath)
  if (!pixbuf) {
    throw new Error(`Failed to load image from file: ${file}`)
  }

  return pixbuf
}

// wrapper for GdkPixbuf.new_from_file_at_scale with error handling
export function getPixbufFromFileAtScale(
  file: imports.gi.Gio.File,
  width: number,
  height: number,
  preserveAspectRatio: boolean,
): imports.gi.GdkPixbuf.Pixbuf {
  if (!file.query_exists(null)) {
    throw new Error(`File does not exist: ${file}`)
  }

  const filePath = file.get_path()
  if (!filePath) {
    throw new Error(`File path is null.`)
  }

  // The new_from_file_at_scale method does not throw an error but has an assertion: ('height > 0 || height == -1') and ('width > 0 || width == -1').
  // Therefore, check parameters in advance.
  if (height !== -1 && height < 1) {
    throw new Error(`Invalid image height value: ${height}`)
  }
  if (width !== -1 && width < 1) {
    throw new Error(`Invalid image width value: ${width}`)
  }

  const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(filePath, width, height, preserveAspectRatio)
  if (!pixbuf) {
    throw new Error(`Failed to load image from file: ${file}`)
  }

  return pixbuf
}
