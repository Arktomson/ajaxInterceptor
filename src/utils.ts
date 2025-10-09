export const getDescriptor = Object.getOwnPropertyDescriptor.bind(Object);

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));