import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import {
  AppDispatch,
  RootState,
  clearAlert,
  switchActiveRoute,
  mapSimulationToRoute,
} from '../store/journeySlice';

export default function RescueAlertOverlay() {
  const dispatch = useDispatch<AppDispatch>();
  const { activeAlert, selectedRoute } = useSelector((s: RootState) => s.journey);

  const isRescueAlert =
    activeAlert &&
    typeof activeAlert === 'object' &&
    activeAlert !== null &&
    'disruption' in activeAlert &&
    'options' in activeAlert;

  const applyOption = (opt: Record<string, unknown>) => {
    const rid = selectedRoute?.id ?? 'JRN';
    const from = selectedRoute?.from ?? '';
    const to = selectedRoute?.to ?? '';
    const sim = opt.route as Record<string, unknown> | undefined;
    if (sim && from && to) {
      const route = mapSimulationToRoute(sim, `${rid}-rescue-${String(opt.id)}`, from, to);
      route.departureTimeIso = selectedRoute?.departureTimeIso;
      dispatch(switchActiveRoute(route));
    }
    dispatch(clearAlert());
  };

  return (
    <AnimatePresence>
      {isRescueAlert && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-[2.5rem] border-2 border-red-500/50 bg-surface-bright/90 p-8 shadow-2xl"
          >
            <div className="absolute left-0 top-0 h-1 w-full bg-red-500/20">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 60, ease: 'linear' }}
                className="h-full bg-red-500"
              />
            </div>

            <div className="mb-8 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/20">
                  <AlertTriangle className="h-8 w-8 animate-pulse text-red-500" />
                </div>
                <div>
                  <h2 className="font-headline text-3xl font-black uppercase tracking-tighter text-red-500">
                    Rescue mode engaged
                  </h2>
                  <p className="text-sm font-medium text-white/60">
                    {(activeAlert as { disruption?: { description?: string } }).disruption?.description}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => dispatch(clearAlert())}
                className="rounded-full p-2 transition-colors hover:bg-white/5"
              >
                <X className="h-6 w-6 text-white/20" />
              </button>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {((activeAlert as { options?: Record<string, unknown>[] }).options || []).map(
                (opt: Record<string, unknown>) => (
                  <motion.div
                    key={String(opt.id)}
                    whileHover={{ scale: 1.02 }}
                    className={`group cursor-pointer rounded-3xl border-2 p-6 transition-all ${
                      opt.rank === 1 ? 'border-primary bg-primary/5' : 'border-white/5 bg-white/5'
                    }`}
                    onClick={() => applyOption(opt)}
                  >
                    <div className="flex h-full flex-col justify-between">
                      <div>
                        <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-white/30">
                          Option 0{Number(opt.rank)}
                        </span>
                        <h3 className="mb-1 font-headline text-xl font-black leading-tight">{String(opt.label)}</h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                          {Number(opt.timeImpactMin) > 0 ? '+' : ''}
                          {Number(opt.timeImpactMin)} min vs current
                        </p>
                      </div>

                      <div className="mt-6 space-y-2">
                        <div className="flex justify-between text-[9px] font-black uppercase">
                          <span className="text-white/40">Reliability</span>
                          <span className={Number(opt.safetyScore) > 80 ? 'text-secondary' : 'text-primary'}>
                            {Number(opt.safetyScore)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-[9px] font-black uppercase">
                          <span className="text-white/40">Est. cost</span>
                          <span className="text-secondary">₹{Math.round(Number(opt.totalPredictedCost))}</span>
                        </div>
                      </div>

                      <span className="mt-6 block w-full rounded-xl bg-white/5 py-3 text-center text-[10px] font-black uppercase tracking-widest transition-all group-hover:bg-primary group-hover:text-surface">
                        Select path
                      </span>
                    </div>
                  </motion.div>
                ),
              )}
            </div>

            <p className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-white/20">
              Automatic fallback in 60s · Decision required immediately
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
