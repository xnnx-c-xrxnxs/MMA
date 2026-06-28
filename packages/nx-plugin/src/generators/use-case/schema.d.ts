export type UseCaseType = 'create' | 'get-by-id' | 'update' | 'delete' | 'action' | 'list';

export interface UseCaseGeneratorSchema {
  domain: string;
  verb: string;
  entity?: string;
  type: UseCaseType;
  filterField?: string;
  actionMethod?: string;
  /**
   * Optional field spec passed by the domain generator, e.g.
   * `"orderId:string,weight:number,address:string?"`. When provided, the
   * `create` and `update` templates emit a complete `Input` interface and
   * a complete `Entity.create({...})` body so the generated code compiles
   * against the freshly-scaffolded entity. When omitted, TODO placeholders
   * are emitted (for the standalone /new-use-case path on existing domains
   * where AI is expected to fill them in).
   */
  fields?: string;
}
