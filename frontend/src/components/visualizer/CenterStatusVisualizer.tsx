import { motion } from 'framer-motion';
import { NeurologicalProfile } from '../../lib/types';

export function CenterStatusVisualizer({
  profile,
  isProcessing,
  progress,
}: {
  profile: NeurologicalProfile;
  isProcessing: boolean;
  progress: number;
}) {
  return (
    <div className="w-full max-w-xl space-y-8">
      <div className="flex flex-wrap gap-3 justify-between text-xs uppercase tracking-wide">
        <div className="text-white/60">
          Model: <span className="text-emerald-500">Tribe v2</span>
        </div>
        <div className="text-white/60">
          Profile: <span className="text-white">{profile}</span>
        </div>
        <div className="text-white/60">
          Status:{' '}
          <span className={isProcessing ? 'text-emerald-500' : 'text-white'}>
            {isProcessing ? 'Processing' : 'Ready'}
          </span>
        </div>
      </div>

      <motion.div
        className="aspect-square border border-white/20 relative overflow-hidden"
        style={{
          clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
        }}
        animate={{
          boxShadow: isProcessing
            ? '0 0 40px rgba(16, 185, 129, 0.5)'
            : '0 0 20px rgba(16, 185, 129, 0.2)',
        }}
        transition={{ duration: 0.3 }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-64 h-64 rounded-full border-2 border-emerald-500/30"
            animate={{
              scale: isProcessing ? [1, 1.05, 1] : 1,
              opacity: isProcessing ? [0.3, 0.6, 0.3] : 0.3,
            }}
            transition={{
              duration: 2,
              repeat: isProcessing ? Infinity : 0,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className="absolute w-48 h-48 rounded-full border border-emerald-500/50"
            animate={{
              scale: isProcessing ? [1, 1.1, 1] : 1,
              opacity: isProcessing ? [0.5, 0.8, 0.5] : 0.5,
            }}
            transition={{
              duration: 2,
              repeat: isProcessing ? Infinity : 0,
              ease: 'easeInOut',
              delay: 0.3,
            }}
          />
          <motion.div
            className="absolute w-32 h-32 rounded-full border-2 border-emerald-500"
            animate={{
              scale: isProcessing ? [1, 1.15, 1] : 1,
              opacity: isProcessing ? [0.7, 1, 0.7] : 0.7,
            }}
            transition={{
              duration: 2,
              repeat: isProcessing ? Infinity : 0,
              ease: 'easeInOut',
              delay: 0.6,
            }}
          />
        </div>

        <div className="absolute inset-0 pointer-events-none opacity-10">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-emerald-500" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-emerald-500" />
        </div>
      </motion.div>

      <div className="space-y-2">
        <div className="h-1 bg-white/10 relative overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 bg-emerald-500"
            style={{ width: `${progress}%` }}
            animate={{
              boxShadow: isProcessing
                ? '0 0 10px rgba(16, 185, 129, 0.8)'
                : '0 0 0px rgba(16, 185, 129, 0)',
            }}
          />
        </div>
        {(isProcessing || progress === 100) && (
          <div className="text-xs text-emerald-500 text-center tracking-wide">{progress}% COMPLETE</div>
        )}
      </div>
    </div>
  );
}
