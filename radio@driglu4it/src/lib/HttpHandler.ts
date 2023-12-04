const { Message, SessionAsync, Session } = imports.gi.Soup;
const { PRIORITY_DEFAULT } = imports.gi.GLib;
const ByteArray = imports.byteArray;

export interface HTTPParams {
  [key: string]: boolean | string | number | undefined;
}

export interface HttpError {
  code: number;
  message: string;
  reason_phrase: string;
}

export function isHttpError(x: any): x is HttpError {
  return typeof x.reason_phrase === "string";
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

// not complete
interface Headers {
  "Content-Type": "application/json" | "application/x-www-form-urlencoded";
  Authorization?: string;
}

export interface LoadJsonArgs<T1> {
  url: string;
  method?: Method;
  headers?: Headers;
  onSuccess: (resp: T1) => void;
  onErr: (err: HttpError) => void;
  onSettled?: () => void;
}

function checkForHttpError(
  message: imports.gi.Soup.Message
): HttpError | false {
  const code = message?.status_code | 0;
  const reason_phrase = message?.reason_phrase || "no network response";

  let errMessage: string | undefined;

  if (code < 100) {
    errMessage = "no network response";
  } else if (code < 200 || code > 300) {
    errMessage = "bad status code";
  } else if (!message.response_body?.data) {
    errMessage = "no response body";
  }

  return errMessage
    ? {
        code,
        reason_phrase,
        message: errMessage,
      }
    : false;
}

type HttpHandler = {
  makeJsonHttpRequest: <T1>(args: LoadJsonArgs<T1>) => void;
};

const createSoup2HttpHandler = (): HttpHandler => {
  const httpSession = new SessionAsync();

  return {
    makeJsonHttpRequest: <T1>(args: LoadJsonArgs<T1>) => {
      const {
        url,
        method = "GET",
        onErr,
        onSuccess,
        onSettled,
        headers,
      } = args;

      // const uri = queryParams ? `${url}?${stringify(queryParams)}` : url
      const message = Message.new(method, url);

      if (!message) {
        throw new Error(`Message Object couldn't be created`);
      }

      headers &&
        Object.entries(headers).forEach(([key, value]) => {
          message.request_headers.append(key, value);
        });

      httpSession.queue_message(message, (session, msgResponse) => {
        onSettled?.();
        const error = checkForHttpError(msgResponse);

        if (error) {
          onErr(error);
          return;
        }

        // TODO: We should actually check if this is really of type T1
        const data = JSON.parse(msgResponse.response_body.data) as T1;
        onSuccess(data);
      });
    },
  };
};

const createSoup3HttpHandler = (): HttpHandler => {
  const httpSession = new Session() as any;

  return {
    makeJsonHttpRequest: <T1>(args: LoadJsonArgs<T1>) => {
      const {
        url,
        method = "GET",
        onErr,
        onSuccess,
        onSettled,
        headers,
      } = args;

      const message = Message.new(method, url);

      if (!message) {
        throw new Error(`Message Object couldn't be created`);
      }

      headers &&
        Object.entries(headers).forEach(([key, value]) => {
          message.request_headers.append(key, value);
        });

      httpSession.send_and_read_async(
        message,
        PRIORITY_DEFAULT,
        null,
        (session: any, result: any) => {
          const res: imports.gi.GLib.Bytes | null =
            httpSession.send_and_read_finish(result);

          // TODO: check for error
          const responseBody =
            res != null ? ByteArray.toString(ByteArray.fromGBytes(res)) : null;

          if (!responseBody) {
            onErr({
              code: 0,
              reason_phrase: "no network response",
              message: "no response body",
            });
            return;
          }

          if (responseBody) {
            const data = JSON.parse(responseBody) as T1;
            onSuccess(data);
          }
        }
      );
    },
  };
};

export const { makeJsonHttpRequest } =
  imports.gi.Soup.MAJOR_VERSION == 2
    ? createSoup2HttpHandler()
    : createSoup3HttpHandler();
