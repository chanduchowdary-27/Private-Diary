import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  r: number;
  opacity: number;
  speed: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  opacity: number;
  color: string;
  life: number;
  maxLife: number;
}

interface StarParticlesProps {
  count?: number;
  variant?: 'vault' | 'light';
  className?: string;
}

export default function StarParticles({
  count = 80,
  variant = 'light',
  className = '',
}: StarParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Stars
    const stars: Star[] = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.6 + 0.2,
      speed: Math.random() * 0.3 + 0.05,
      twinkleSpeed: Math.random() * 0.03 + 0.01,
      twinklePhase: Math.random() * Math.PI * 2,
    }));

    // Floating particles
    const colours = variant === 'vault'
      ? ['#c9aff0', '#9d6de8', '#f9c6d4', '#f5c842']
      : ['#f9c6d4', '#c9aff0', '#fde8f0', '#e87fa0'];

    const particles: Particle[] = [];

    const spawnParticle = () => {
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + 10,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -(Math.random() * 1.2 + 0.4),
        r: Math.random() * 4 + 2,
        opacity: Math.random() * 0.6 + 0.3,
        color: colours[Math.floor(Math.random() * colours.length)],
        life: 0,
        maxLife: Math.random() * 200 + 150,
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw stars
      stars.forEach(s => {
        const twinkle = Math.sin(t * s.twinkleSpeed + s.twinklePhase) * 0.4 + 0.6;
        ctx.save();
        ctx.globalAlpha = s.opacity * twinkle;
        ctx.fillStyle = variant === 'vault' ? '#ffffff' : '#9d6de8';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Drift slowly upward
        s.y -= s.speed;
        if (s.y < -5) {
          s.y = canvas.height + 5;
          s.x = Math.random() * canvas.width;
        }
      });

      // Draw + update particles
      if (t % 15 === 0) spawnParticle();
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        const frac = p.life / p.maxLife;
        const alpha = p.opacity * (1 - frac);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 - frac * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (p.life >= p.maxLife) particles.splice(i, 1);
      });

      t++;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [count, variant]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      aria-hidden="true"
    />
  );
}
