export const getDescriptor = Object.getOwnPropertyDescriptor.bind(Object);

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const getType = Object.prototype.toString.call.bind(
  Object.prototype.toString
);

export const resolveUrl = (url: string | URL = '') => {
  return new URL(url, window.location.href).toString();
};

export const safeStringify = (value: any) => {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value) || String(value);
  } catch (error) {
    return '';
  }
};

export const getProxyValue = (target: object, prop: string | symbol) => {
  const value = Reflect.get(target, prop);
  if (typeof value !== 'function') {
    return value;
  }
  return function (...args: any[]) {
    return Reflect.apply(value as (...params: any[]) => any, target, args);
  };
};

export const copyNativePropsAndPrototype = ({
  source,
  target,
  prototype,
}: {
  source: Record<string, any>;
  target: Record<string, any>;
  prototype: object;
}) => {
  Object.keys(source).forEach((key) => {
    target[key] = source[key];
  });
  target.prototype = prototype;
};
