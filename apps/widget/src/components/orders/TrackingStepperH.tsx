import { CircleCheck, Package, Truck } from 'lucide-react';
import type { Tracking } from '../../lib/types';
import { deliveryStepLabels, deliveryStepState } from '../../lib/delivery';

/**
 * Horizontal shipment progress on a delivery card (ivy-docs T03, Figma
 * `1007:1069`): a 40px circle per step holding only its icon — box, truck,
 * truck, check — blue once reached, grey before; blue rail between reached
 * steps, grey after; the label under each circle.
 *
 * The vertical `TrackingStepper` still serves the order-detail view.
 *
 * The count of steps is data (`TrackingResponse.steps`) — do not assume the
 * design's four. The words follow the widget's language (`deliveryStepLabels`,
 * T14). The icons follow the design for four and repeat the truck for any
 * extra middle step.
 */
export function TrackingStepperH({
  tracking,
  labels,
}: {
  tracking: Tracking;
  /** The widget's localized step table (`orders.trackingSteps`). */
  labels: string[];
}) {
  const steps = deliveryStepLabels(tracking.steps, labels);
  if (!steps.length) return null;
  const last = steps.length - 1;
  const reached = (i: number) => deliveryStepState(i, tracking.stepIndex, steps.length) !== 'todo';

  return (
    <ol className="flex items-start">
      {steps.map((label, i) => {
        const state = deliveryStepState(i, tracking.stepIndex, steps.length);
        const on = state !== 'todo';
        const Glyph = i === last ? CircleCheck : i === 0 ? Package : Truck;
        return (
          <li
            key={i}
            data-testid="delivery-step"
            data-state={state}
            aria-current={state === 'current' ? 'step' : undefined}
            className="flex min-w-0 flex-1 flex-col items-center"
          >
            <div className="flex w-full items-center" aria-hidden="true">
              {/* Half-width rails on each side keep the circle centred over its
                  label, so the rail stays continuous without a grid. */}
              <span className={`h-0.5 flex-1 ${i === 0 ? 'bg-transparent' : on ? 'bg-primary-500' : 'bg-gray-200'}`} />
              <span
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white ${
                  on ? 'bg-primary-500' : 'bg-gray-300'
                }`}
              >
                <Glyph className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
              <span
                className={`h-0.5 flex-1 ${i === last ? 'bg-transparent' : reached(i + 1) ? 'bg-primary-500' : 'bg-gray-200'}`}
              />
            </div>
            <span
              className={`mt-1.5 w-full break-keep px-0.5 text-center text-xs leading-tight ${
                on ? 'text-primary-600' : 'text-gray-500'
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
