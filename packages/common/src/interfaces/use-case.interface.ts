/**
 * IUseCase<I, O>
 * Generic contract for all application use cases across the platform.
 *
 * I — input type  (use a single input object; wrap multi-param calls into one type)
 * O — output type (the resolved value of the returned Promise)
 *
 * Benefits:
 * - Enforces a consistent `execute()` entry point on every use case
 * - Enables generic cross-cutting utilities (logging, tracing, retry wrappers)
 * - Uniform mocking shape in tests
 */
export interface IUseCase<I, O> {
  execute(input: I): Promise<O>;
}
