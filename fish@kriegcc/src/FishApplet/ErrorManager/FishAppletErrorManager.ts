/**
 * Describes at which part of the applet the error occurred.
 */
export type ErrorLocation = "animation" | "command" | "commandExecution"

export type FishAppletError = {
  type: "Warning" | "Error" // type "Warning" not in use yet
  location: ErrorLocation
  message: string
}

type ErrorDictionary = Partial<Record<ErrorLocation, FishAppletError[]>>

/**
 * Stores errors and is used to manage the applet's state (normal / error).
 */
export class FishAppletErrorManager {
  private errors: ErrorDictionary

  constructor() {
    this.errors = {}
  }

  public addError(error: FishAppletError) {
    if (!this.errors[error.location]) {
      this.errors[error.location] = []
    }
    this.errors[error.location]?.push(error)
  }

  public getError(location: ErrorLocation): FishAppletError[] | undefined {
    return this.errors[location]
  }

  public getAllErrors(): FishAppletError[] {
    const allErrors: FishAppletError[] = []
    for (const location in this.errors) {
      if (Object.prototype.hasOwnProperty.call(this.errors, location)) {
        const errorsAtLocation = this.errors[location as ErrorLocation]
        if (errorsAtLocation) {
          allErrors.push(...errorsAtLocation)
        }
      }
    }
    return allErrors
  }

  public deleteError(location: ErrorLocation) {
    // Need to explicitly delete the key, otherwise hasErrors() won't work.
    // Alternatives without disabling eslint rules:
    // 1)
    // const { [location]: _, ...rest } = this.errors
    // this.errors = rest
    // 2)
    // requires adjustment of hasErrors()
    // this.errors[location] = undefined

    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this.errors[location]
  }

  public hasError(location: ErrorLocation): boolean {
    const errorsAtLocation = this.errors[location]
    return errorsAtLocation !== undefined && errorsAtLocation.length > 0
  }

  public hasErrors(): boolean {
    return Object.keys(this.errors).length !== 0
  }
}
