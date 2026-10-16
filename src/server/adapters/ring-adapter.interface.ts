import { VisitorEvent } from '../../shared/types.js';

export interface RingAdapter {
  initialize(): Promise<void>;
  onVisitorEvent(handler: (event: VisitorEvent) => void | Promise<void>): void;
}
