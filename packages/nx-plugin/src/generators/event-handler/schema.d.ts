export interface EventHandlerGeneratorSchema {
  domain: string;
  entity?: string;
  /** Comma-separated CONSTANT_CASE event types (e.g. "USER_DELETED,USER_DEACTIVATED"). */
  eventTypes: string;
  /**
   * If true, this handler consumes events from a different bounded context.
   * Dispatcher imports schemas from `@old-st/contracts/{sourceDomain}`.
   * Handler stubs use `Extract<...DomainEvent, {eventType:'X'}>` for payload typing.
   * Default: false.
   */
  crossDomain?: boolean;
  /** Required when crossDomain=true. The publishing domain (kebab-case). */
  sourceDomain?: string;
  skipFormat?: boolean;
}
