export async function retryPromiseMock<T extends () => Promise<any>>(
  executor: T
): Promise<ReturnType<T>> {
  return executor();
}
