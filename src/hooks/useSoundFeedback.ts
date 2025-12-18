import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SoundSettings {
  enabled: boolean;
  volume: number;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
}

export const useSoundSettings = create<SoundSettings>()(
  persist(
    (set) => ({
      enabled: false, // 默认关闭，避免打扰
      volume: 0.3,
      setEnabled: (enabled) => set({ enabled }),
      setVolume: (volume) => set({ volume }),
    }),
    {
      name: 'sound-settings',
    }
  )
);

// 简单的音频合成器
const audioContext = typeof window !== 'undefined' 
  ? new (window.AudioContext || (window as any).webkitAudioContext)() 
  : null;

export function playTone(frequency: number, duration: number, type: OscillatorType = 'sine') {
  const { enabled, volume } = useSoundSettings.getState();
  if (!enabled || !audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  
  // Envelope
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

// 预定义音效
export const sounds = {
  // 订单提交 - 清脆的确认音
  orderSubmit: () => {
    playTone(800, 0.1, 'sine');
    setTimeout(() => playTone(1000, 0.1, 'sine'), 100);
  },

  // 订单成交 - 愉悦的成功音
  orderFilled: () => {
    playTone(523, 0.1, 'sine'); // C5
    setTimeout(() => playTone(659, 0.1, 'sine'), 100); // E5
    setTimeout(() => playTone(784, 0.15, 'sine'), 200); // G5
  },

  // 部分成交 - 单音提示
  orderPartial: () => {
    playTone(600, 0.15, 'sine');
  },

  // 订单取消 - 低沉的确认音
  orderCancelled: () => {
    playTone(400, 0.15, 'triangle');
  },

  // 错误/拒绝 - 警告音
  error: () => {
    playTone(200, 0.2, 'sawtooth');
  },

  // 价格警报 - 注意音
  priceAlert: () => {
    playTone(880, 0.1, 'sine');
    setTimeout(() => playTone(880, 0.1, 'sine'), 150);
  },

  // 点击反馈 - 轻微的点击音
  click: () => {
    playTone(1200, 0.03, 'sine');
  },
};





