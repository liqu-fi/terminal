import { 
  BarChart2, BarChart3, Briefcase, Search, Activity, AlertTriangle, X, Check, Info,
  ChevronLeft, ChevronRight, Pause, Zap, Star, Pencil, ArrowUpDown, ArrowUp, ArrowDown,
  Settings, Bell, Globe, Wifi, WifiOff, RefreshCw, Plus, Minus, LineChart,
  Wallet, ClipboardList, ArrowLeftRight, Star as StarOutline,
  TrendingUp, TrendingDown, AlertCircle,
  // Wallet page icons
  Download, Upload, Copy, Link, History, Building2, CheckCircle, Loader, Trash2,
  CreditCard, ExternalLink, ChevronDown, ChevronUp, Filter, Clock,
  Sun, Moon, List, Inbox, Archive, Play,
  // Chart icons
  Maximize2, Minimize2, Target, Crosshair
} from 'lucide-react';
import { CSSProperties } from 'react';

export type IconName =
  | 'bar-chart-2'
  | 'bar-chart-3'
  | 'briefcase'
  | 'search'
  | 'activity'
  | 'alert-triangle'
  | 'alert-circle'
  | 'x'
  | 'check'
  | 'info'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'chevron-up'
  | 'pause'
  | 'zap'
  | 'star'
  | 'star-filled'
  | 'pencil'
  | 'arrow-up-down'
  | 'arrow-up'
  | 'arrow-down'
  | 'trending-up'
  | 'trending-down'
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
  | 'arrow-left-right'
  // Wallet page icons
  | 'download'
  | 'upload'
  | 'copy'
  | 'link'
  | 'history'
  | 'building-2'
  | 'check-circle'
  | 'loader'
  | 'trash-2'
  | 'credit-card'
  | 'external-link'
  | 'filter'
  | 'clock'
  | 'sun'
  | 'moon'
  | 'list'
  | 'inbox'
  | 'archive'
  | 'play'
  | 'maximize-2'
  | 'minimize-2'
  | 'target'
  | 'crosshair';

const iconMap: Record<IconName, typeof BarChart3> = {
  'bar-chart-2': BarChart2,
  'bar-chart-3': BarChart3,
  'briefcase': Briefcase,
  'search': Search,
  'activity': Activity,
  'alert-triangle': AlertTriangle,
  'alert-circle': AlertCircle,
  'x': X,
  'check': Check,
  'info': Info,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  'pause': Pause,
  'zap': Zap,
  'star': StarOutline,
  'star-filled': Star,
  'pencil': Pencil,
  'arrow-up-down': ArrowUpDown,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
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
  // Wallet page icons
  'download': Download,
  'upload': Upload,
  'copy': Copy,
  'link': Link,
  'history': History,
  'building-2': Building2,
  'check-circle': CheckCircle,
  'loader': Loader,
  'trash-2': Trash2,
  'credit-card': CreditCard,
  'external-link': ExternalLink,
  'filter': Filter,
  'clock': Clock,
  'sun': Sun,
  'moon': Moon,
  'list': List,
  'inbox': Inbox,
  'archive': Archive,
  'play': Play,
  'maximize-2': Maximize2,
  'minimize-2': Minimize2,
  'target': Target,
  'crosshair': Crosshair,
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





