/**
 * IEventHandler<TPayload>
 *
 * Contract for per-event handler services.
 * One implementing class exists per event type.
 */
export interface IEventHandler<TPayload> {
  handle(payload: TPayload, messageId?: string): Promise<void>;
}
