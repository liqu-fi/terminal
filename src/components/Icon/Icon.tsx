import { 
  BarChart2, BarChart3, Briefcase, Search, Activity, AlertTriangle, X, Check, Info,
  ChevronLeft, ChevronRight, Pause, Zap, Star, Pencil, ArrowUpDown, ArrowUp, ArrowDown,
  Settings, Bell, Globe, Wifi, WifiOff, RefreshCw, Plus, Minus, LineChart,
  Wallet, ClipboardList, ArrowLeftRight, Star as StarOutline
} from 'lucide-react';
import { CSSProperties } from 'react';

export type IconName =
  | 'bar-chart-2'
  | 'bar-chart-3'
  | 'briefcase'
  | 'search'
  | 'activity'
  | 'alert-triangle'
  | 'x'
  | 'check'
  | 'info'
  | 'chevron-left'
  | 'chevron-right'
  | 'pause'
  | 'zap'
  | 'star'
  | 'star-filled'
  | 'pencil'
  | 'arrow-up-down'
  | 'arrow-up'
  | 'arrow-down'
  | 'settings'
  | 'bell'
  | 'globe'
  | 'wifi'
  | 'wifi-off'
  | 'refresh-cw'
  | 'plus'
  | 'minus'
  | 'line-chart'
  | 'wallet'
  | 'clipboard-list'
  | 'arrow-left-right';

const iconMap: Record<IconName, typeof BarChart3> = {
  'bar-chart-2': BarChart2,
  'bar-chart-3': BarChart3,
  'briefcase': Briefcase,
  'search': Search,
  'activity': Activity,
  'alert-triangle': AlertTriangle,
  'x': X,
  'check': Check,
  'info': Info,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'pause': Pause,
  'zap': Zap,
  'star': StarOutline,
  'star-filled': Star,
  'pencil': Pencil,
  'arrow-up-down': ArrowUpDown,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'settings': Settings,
  'bell': Bell,
  'globe': Globe,
  'wifi': Wifi,
  'wifi-off': WifiOff,
  'refresh-cw': RefreshCw,
  'plus': Plus,
  'minus': Minus,
  'line-chart': LineChart,
  'wallet': Wallet,
  'clipboard-list': ClipboardList,
  'arrow-left-right': ArrowLeftRight,
};

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizeMap: Record<IconSize, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
};

export interface IconProps {
  name: IconName;
  size?: IconSize;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
}

export function Icon({ 
  name, 
  size = 'md', 
  className = '', 
  style,
  strokeWidth = 1.5 
}: IconProps) {
  const IconComponent = iconMap[name];
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  const iconSize = sizeMap[size];

  return (
    <IconComponent
      size={iconSize}
      strokeWidth={strokeWidth}
      className={className}
      style={style}
    />
  );
}





