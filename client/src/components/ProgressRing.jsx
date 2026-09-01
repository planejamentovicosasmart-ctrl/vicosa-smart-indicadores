export function ProgressRing({ value = 0, size = 84, label }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="progress-ring" style={{ '--progress': `${safe * 3.6}deg`, width: size, height: size }} aria-label={`${label || 'Progresso'}: ${safe}%`}>
      <div className="progress-ring-inner"><strong>{safe}%</strong></div>
    </div>
  );
}
