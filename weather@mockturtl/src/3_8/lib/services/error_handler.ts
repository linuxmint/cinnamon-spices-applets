import type { AppletError } from "../../types";
import { Event } from "../events";

export class ErrorHandler {
	private static instance: ErrorHandler;

	public static get Instance(): ErrorHandler {
		if (this.instance == null)
			this.instance = new ErrorHandler();
		return this.instance;
	}

	private constructor() { }

	public readonly OnError = new Event<ErrorHandler, AppletError>();

	public PostError(error: AppletError): void {
		this.OnError.Invoke(this, error);
	}
}