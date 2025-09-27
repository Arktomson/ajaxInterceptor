import { AJAX_TYPE } from "./constant";

export interface AjaxResponse {
  status: number;
  statusText: string;
  response:
    | string
    | number
    | Record<string, any>
    | Blob
    | ArrayBuffer
    | ReadableStream;
  responseText: string;
  responseXML: string;

}
export interface AjaxHookerRequest {
  type: keyof typeof AJAX_TYPE;
  method: string;
  url: string | URL;
  headers: Record<string, string>;
  async: boolean;
  body:
    | string
    | Record<string, any>
    | FormData
    | URLSearchParams
    | Blob
    | ArrayBuffer
    | ReadableStream
    | null;
  response: (response: AjaxResponse) => void;
}
