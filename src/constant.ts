export const AJAX_TYPE = {
  XHR: "xhr",
  FETCH: "fetch",
} as const;

export type AjaxType = (typeof AJAX_TYPE)[keyof typeof AJAX_TYPE];

export const CYCLE_SCHEDULER = Symbol('CycleScheduler');