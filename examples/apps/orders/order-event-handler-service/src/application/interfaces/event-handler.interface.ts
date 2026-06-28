/**
 * IEventHandler<TPayload>
 *
 * Contract for per-event handler services.
 * One implementing class exists per event type — each class owns all logic
 * for its specific event and can inject its own use cases independently.
 *
 * Rules:
 *   - Never import this interface in infrastructure or presentation code.
 *   - `messageId` is optional — used only for logging; never as business key.
 */
export interface IEventHandler<TPayload> {
  handle(payload: TPayload, messageId?: string): Promise<void>;
}
